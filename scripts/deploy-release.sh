#!/usr/bin/env bash
#
# 服务器侧 · 原子发布 + 健康检查 + 自动回滚（在 Rocky 上执行）
#
# 用法：
#   bash deploy-release.sh <tarball> <release-id> [root-dir]
#
# 例：
#   bash deploy-release.sh /tmp/jizhi-release/jizhi-abc123.tar.gz abc123 /opt/jizhi
#
# ── 为什么是「切 symlink」而不是「覆盖文件」─────────────────────────────
# 直接覆盖 /opt/jizhi/current 里的文件，会出现**新旧文件混在一起**的中间态：
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
ROOT="${3:-/opt/jizhi}"

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
APP_PORT="${APP_PORT:-3000}"
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

# 需要 root 的操作：写 /opt/jizhi、restart systemd。
#
# SUDO 的三态（用 ${SUDO+x} 判断「是否被设置」，不能用 ${SUDO:-}）：
#   未设置    → 自动探测：有 sudo 就用 sudo，没有就报错退出
#   设置为空 → 显式表示「不加提权前缀」（root 直连 / 自定义提权 / 本地测试）
#   设置为值 → 直接用该值（如 "sudo -n"）
#
# 注意 ${SUDO:-} 做不到这件事：它把「未设置」和「显式空串」都变成空串，
# 于是外部传 SUDO="" 也拦不住脚本自动加回 sudo。
if [ "$(id -u)" -eq 0 ]; then
    SUDO=""
elif [ -n "${SUDO+x}" ]; then
    :                                       # 外部已显式指定，尊重它
elif command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
else
    err "需要 root 或 sudo 权限（或显式设置 SUDO= 走自定义提权）"
    exit 1
fi

# ── 1. 校验包完整性 ──────────────────────────────────────────────────────
[ -f "$TARBALL" ] || { err "找不到发布包：$TARBALL"; exit 1; }

if [ -f "$TARBALL.sha256" ]; then
    log "校验 SHA256"
    ( cd "$(dirname "$TARBALL")" && sha256sum -c "$(basename "$TARBALL").sha256" ) \
        || { err "校验失败：发布包在传输中损坏，不要发布"; exit 1; }
else
    warn "没有 .sha256 文件，跳过校验"
fi

# ── 2. 解包到独立版本目录 ───────────────────────────────────────────────
log "解包 → $RELEASE_DIR"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"
tar -xzf "$TARBALL" -C "$RELEASE_DIR"

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
        rm -rf "$d"
        log "已删除旧版本 $(basename "$d")"
    done <<< "$OLD_LIST"
fi

log "发布完成：$RELEASE_ID"
log "当前版本：$(readlink "$CURRENT")"
