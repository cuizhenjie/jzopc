#!/usr/bin/env bash
#
# 服务器侧 · 原子发布 + 健康检查 + 自动回滚（在 Rocky 上执行）
#
# 用法：
#   bash deploy-release.sh <tarball> <release-id> [root-dir]
#
# 例：
#   bash deploy-release.sh /tmp/jizhi-release/jizhi-abc123.tar.gz abc123 /data/app-home/jizhi
#
# ── 为什么是「切 symlink」而不是「覆盖文件」─────────────────────────────
# 直接覆盖 /data/app-home/jizhi/current 里的文件，会出现**新旧文件混在一起**的中间态：
# server.js 已换新、.next/server 还是旧的 → 运行时报错或返回诡异结果。
# 正确做法是：每个版本解到独立目录 releases/<id>/，然后原子切 symlink：
#   ln -sfn releases/<id> current.tmp && mv -Tf current.tmp current
# mv -T 底层是 rename() 系统调用 → **原子**。读者要么看到完整旧版，
# 要么看到完整新版，不存在中间态。
#
# ── 为什么重启后必须做健康检查 ──────────────────────────────────────────
# 新版本可能因为环境变量缺失、构建期变量没注入、OG 字体缺失等原因起不来。
# Next 的失败模式很隐蔽：进程起来但页面 500，或者首页白屏但进程还在。
# 所以：重启 → 探活 → 不通过就**自动回滚到上一个版本**并重启。
#
# ── 环境变量 ────────────────────────────────────────────────────────────
#   PROCESS_MANAGER=systemd|pm2     默认 systemd
#   APP_USER=jizhi                 运行服务的系统用户
#   KEEP_RELEASES=5                保留最近几个版本（用于回滚）
#
set -euo pipefail

TARBALL="${1:?用法: deploy-release.sh <tarball> <release-id> [root-dir]}"
RELEASE_ID="${2:?用法: deploy-release.sh <tarball> <release-id> [root-dir]}"
ROOT="${3:-/data/app-home/jizhi}"

[[ "$RELEASE_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || { echo '非法 release-id' >&2; exit 1; }
[ "$(uname -s)" = Linux ] || { echo '发布必须在 Linux 执行' >&2; exit 1; }
# 显式 SUDO='' 仅用于无提权的本地 fixture 测试；真实发布应 sudo 整个脚本。
if [ "$(id -u)" -ne 0 ] && ! { [ "${SUDO+x}" = x ] && [ -z "$SUDO" ]; }; then
    echo '请用 sudo 执行整个 deploy-release.sh' >&2
    exit 1
fi
for command in node python3 flock; do
    command -v "$command" >/dev/null || { echo "缺少命令：$command" >&2; exit 1; }
done

# 规范化部署根目录（解析符号链接）。
#
# 为什么必须做：首次发布用 `ln -sfn "$RELEASE_DIR"` 写的是**字面路径**，
# 而回滚时用的是 `readlink -f "$CURRENT"` 得到的**真实路径**。若 ROOT 本身
# 含符号链接（macOS 的 /tmp → /private/tmp、某些服务器把 /opt 软链到 /data），
# 两条路径会指向同一目录却长得不一样 → 排查时「current 到底指向哪」变得很难判断，
# 清理旧版本时的路径比较也会失配。
mkdir -p "$ROOT"
ROOT="$(cd "$ROOT" && pwd -P)"

APP_USER="${APP_USER:-jizhi}"
PROCESS_MANAGER="${PROCESS_MANAGER:-systemd}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
APP_PORT="${APP_PORT:-4000}"
SERVICE_NAME="${SERVICE_NAME:-jizhi}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-30}"     # 健康检查重试次数
HEALTH_INTERVAL="${HEALTH_INTERVAL:-2}"       # 重试间隔（秒）

RELEASES="$ROOT/releases"
CURRENT="$ROOT/current"
RELEASE_DIR="$RELEASES/$RELEASE_ID"
HEALTH_HOST="127.0.0.1:${APP_PORT}"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; }

SUDO=""
[[ "$KEEP_RELEASES" =~ ^[0-9]+$ ]] && [ "$KEEP_RELEASES" -ge 2 ] || { err 'KEEP_RELEASES 必须 >= 2'; exit 1; }
exec 9>"$ROOT/.deploy.lock"
flock -n 9 || { err '已有发布正在进行'; exit 1; }
[ ! -e "$CURRENT" ] || [ -L "$CURRENT" ] || { err 'current 必须是符号链接'; exit 1; }
if [ -e "$RELEASE_DIR" ] || [ -L "$RELEASE_DIR" ]; then
    err "版本目录已存在，拒绝覆盖：$RELEASE_ID"
    exit 1
fi

# ── 1. 校验包完整性 ──────────────────────────────────────────────────────
[ -f "$TARBALL" ] || { err "找不到发布包：$TARBALL"; exit 1; }

[ -f "$TARBALL.sha256" ] || { err "缺少 .sha256 文件，拒绝发布"; exit 1; }
log "校验实际发布包的 SHA256"
python3 - "$TARBALL" <<'PYHASH'
import hashlib, os, re, sys
archive = sys.argv[1]
with open(archive + '.sha256', 'r', encoding='utf-8') as stream:
    record = stream.read(4097)
match = re.fullmatch(r'([0-9a-fA-F]{64}) [ *]([^\r\n]+)\n?', record)
if not match or match[2] != os.path.basename(archive):
    raise SystemExit('校验文件必须只有一条记录，且文件名必须匹配实际发布包')
digest = hashlib.sha256()
with open(archive, 'rb') as stream:
    for chunk in iter(lambda: stream.read(1024 * 1024), b''):
        digest.update(chunk)
if digest.hexdigest() != match[1].lower():
    raise SystemExit('发布包 SHA256 不匹配，拒绝发布')
PYHASH

# 在解包前验证路径、链接和平台。允许 pnpm 的包内相对 symlink。
python3 - "$TARBALL" "$RELEASE_ID" "$(node -p 'process.arch')" <<'PY'
import json, posixpath, sys, tarfile
archive, release_id, arch = sys.argv[1:]
def fail(message):
    raise SystemExit('发布包验证失败：' + message)
def safe(name):
    normalized = posixpath.normpath(name)
    if name.startswith('/') or normalized == '..' or normalized.startswith('../'):
        fail('路径越界')
    if any(p == '.env' or p.startswith('.env.') for p in normalized.split('/')):
        fail('包含环境文件')
    return normalized
with tarfile.open(archive, 'r:gz') as tar:
    members = tar.getmembers()
    paths = {}
    links = set()
    for item in members:
        name = safe(item.name)
        if name in paths:
            fail('重复成员')
        paths[name] = item
        if not (item.isfile() or item.isdir() or item.issym() or item.islnk()):
            fail('不支持的成员类型')
        if item.issym() or item.islnk():
            links.add(name)
            target = item.linkname
            if target.startswith('/'):
                fail('绝对链接')
            safe(posixpath.join(posixpath.dirname(name), target) if item.issym() else target)
    for name in paths:
        parent = posixpath.dirname(name)
        while parent:
            if parent in links:
                fail('成员位于链接目录下')
            parent = posixpath.dirname(parent)
    # 按原始目标逐段检查；不能先 normpath，否则 pivot/../x 会隐藏链接跳转。
    # pnpm 指向 .pnpm 下真实包目录的相对链接可用；经另一链接的目标一律拒绝。
    # 此约束同时拒绝链接环与任意深度的链接链。
    for name in links:
        item = paths[name]
        parts = posixpath.dirname(name).split('/') if item.issym() else []
        parts = [part for part in parts if part and part != '.']
        for part in item.linkname.split('/'):
            if not part or part == '.':
                continue
            if part == '..':
                if not parts:
                    fail('链接解析后越界')
                parts.pop()
            else:
                parts.append(part)
                if '/'.join(parts) in links:
                    fail('链接目标经过另一链接或存在循环')
    metadata = paths.get('RELEASE-METADATA.json')
    if not metadata or not metadata.isfile() or metadata.size > 16384:
        fail('缺少或无效的发布元数据')
    data = json.load(tar.extractfile(metadata))
    if data.get('platform') != 'linux' or data.get('arch') != arch:
        fail('平台或CPU架构不匹配')
    if data.get('releaseId') != release_id:
        fail('版本号与包内元数据不一致')
PY

# ── 2. 解包到独立版本目录 ───────────────────────────────────────────────
log "解包 → $RELEASE_DIR"
mkdir -p "$RELEASES"
mkdir "$RELEASE_DIR"
tar --no-same-owner -xzf "$TARBALL" -C "$RELEASE_DIR"

# 解包后必须真的有入口与静态资源。
# 缺 server.js → 进程起不来；缺 .next/static → 整站白屏但 HTTP 仍是 200；
# 缺 public → 图标 404。这三种都不报错，只是「看起来坏了」。
for must in "server.js" ".next/static" "public"; do
    [ -e "$RELEASE_DIR/$must" ] || { err "发布包缺少 ${must}，拒绝上线"; rm -rf "$RELEASE_DIR"; exit 1; }
done

# 文件属主交给运行服务的用户（.next/cache 需要可写，否则 ISR 再生成会失败）
if id -u "$APP_USER" >/dev/null 2>&1; then
    chown -R "$APP_USER:$APP_USER" "$RELEASE_DIR"
fi

# ── 3. 记录当前版本（回滚目标）──────────────────────────────────────────
PREV_TARGET=""
if [ -L "$CURRENT" ]; then
    PREV_TARGET="$(readlink -f "$CURRENT")"
fi
if [ -z "$PREV_TARGET" ]; then
    warn "没有可回滚的历史版本（首次发布）"
fi

# ── 4. 原子切 symlink ────────────────────────────────────────────────────
# 为什么要原子：直接覆盖文件会出现「新旧文件混在一起」的中间态
# （server.js 已换新、.next/server 还是旧的 → 运行时报错或返回诡异结果）。
# 解法是每个版本解到独立目录，再用 rename() 原子替换 symlink。
#
# GNU coreutils（Rocky Linux）的 `mv -T` 底层就是 rename()，是真正的原子替换。
# `-T` 不可省：没有它，mv 会把源「移进」目标 symlink 指向的目录里，而不是替换它。
# BSD mv（macOS）没有 -T，这里保留一个非原子回退，仅为本地调试方便；
# 生产环境是 Rocky，走的是 GNU mv -T 的原子分支。
atomic_symlink() {
    local target="$1" linkpath="$2"
    ln -sfn "$target" "${linkpath}.tmp"
    if mv -Tf "${linkpath}.tmp" "$linkpath" 2>/dev/null; then
        return 0
    fi
    warn "mv -T 不可用，退化为非原子 symlink 替换（仅建议本地调试使用）"
    ln -sfn "$target" "$linkpath"
}

log "切换 current → releases/$RELEASE_ID"
atomic_symlink "$RELEASE_DIR" "$CURRENT"

# ── 5. 重启服务 ──────────────────────────────────────────────────────────
restart_service() {
    case "$PROCESS_MANAGER" in
        systemd)
            $SUDO systemctl restart "$SERVICE_NAME"
            ;;
        pm2)
            # delete + start 而不是 reload：
            # pm2.config.cjs 里的 cwd 是 __dirname（= releases/<id>，真实路径），
            # 切 symlink 后 reload 仍会跑旧目录。delete+start 强制重新绑定 cwd。
            $SUDO pm2 delete "$SERVICE_NAME" >/dev/null 2>&1 || true
            $SUDO pm2 start "$CURRENT/pm2.config.cjs" --cwd "$CURRENT" --update-env
            $SUDO pm2 save >/dev/null 2>&1 || true
            ;;
        *)
            err "未知 PROCESS_MANAGER=${PROCESS_MANAGER}（systemd|pm2）"
            exit 1
            ;;
    esac
}

log "重启服务（${PROCESS_MANAGER}）"
if ! restart_service; then
    err "服务重启失败"
    if [ -n "$PREV_TARGET" ]; then
        warn "回滚到 $PREV_TARGET"
        atomic_symlink "$PREV_TARGET" "$CURRENT"
        restart_service || true
    fi
    err "回滚后仍无法启动，请看日志：journalctl -u $SERVICE_NAME -n 100 --no-pager"
    exit 1
fi

# ── 6. 健康检查 ──────────────────────────────────────────────────────────
# 检查三个点，缺一不可：
#   /            首页 200 —— 页面能出
#   /robots.txt  200 —— 静态路由由 Node 提供（不是 nginx 直接发的文件）
#   /api/leads   405 —— GET 被拒是**预期**（该接口只收 POST）。返回 405 才能
#                    证明 API 路由代码真的在跑，而不是只出了个静态壳子。
# 只探 / 是不够的：首页可能是预渲染产物，API 挂了照样 200。
health_check() {
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://${HEALTH_HOST}/" || echo 000)
    [ "$code" = "200" ] || { warn "健康检查 / 返回 $code"; return 1; }

    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://${HEALTH_HOST}/robots.txt" || echo 000)
    [ "$code" = "200" ] || { warn "健康检查 /robots.txt 返回 $code"; return 1; }

    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://${HEALTH_HOST}/api/leads" || echo 000)
    [ "$code" = "405" ] || { warn "健康检查 /api/leads 返回 ${code}（预期 405）"; return 1; }

    return 0
}

log "健康检查 http://${HEALTH_HOST}"
HEALTHY=0
for i in $(seq 1 "$HEALTH_ATTEMPTS"); do
    if health_check; then
        HEALTHY=1
        log "健康检查通过（${i} 次尝试）"
        break
    fi
    sleep "$HEALTH_INTERVAL"
done

if [ "$HEALTHY" -ne 1 ]; then
    err "健康检查未通过 —— 新版本判定为不可用"
    if [ -n "$PREV_TARGET" ]; then
        warn "自动回滚到 $PREV_TARGET"
        atomic_symlink "$PREV_TARGET" "$CURRENT"
        restart_service || true
        sleep 3
        if health_check; then
            err "已回滚到上一个版本，站点恢复正常。新版本请排查后再发布。"
        else
            err "回滚后健康检查仍未通过 —— 手动介入：journalctl -u $SERVICE_NAME -n 200 --no-pager"
        fi
    else
        err "首次发布且无历史版本可回滚，站点当前不可用，请手动处理"
    fi
    exit 1
fi

# ── 7. 清理旧版本 ────────────────────────────────────────────────────────
# 保留最近 KEEP_RELEASES 个，且**永远不删当前版本**。
log "清理旧版本（保留最近 ${KEEP_RELEASES} 个）"
CURRENT_REAL="$(readlink -f "$CURRENT")"
# 按修改时间倒序，第 KEEP_RELEASES+1 个及之后删除。
# `|| true` 必须在**管道整体**外面：releases 为空时 ls 返回非零，
# pipefail 会把它传播成脚本失败（第一次发布就会踩到）。
OLD_LIST="$(ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n "+$((KEEP_RELEASES + 1))" || true)"
if [ -n "$OLD_LIST" ]; then
    while read -r d; do
        d="${d%/}"
        [ "$d" = "$CURRENT_REAL" ] && continue
        [ "$d" = "$PREV_TARGET" ] && continue
        rm -rf "$d"
        log "已删除旧版本 $(basename "$d")"
    done <<< "$OLD_LIST"
fi

log "发布完成：$RELEASE_ID"
log "当前版本：$(readlink "$CURRENT")"
