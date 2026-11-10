#!/usr/bin/env bash
#
# 构建机侧 · 产出可发布的部署包
#
# 用法（在有源码的机器上，仓库根目录）：
#   bash scripts/build-release.sh              # 构建 + 打包
#   bash scripts/build-release.sh --skip-build  # 复用已有的 .next 产物，只组装打包
#
# ⚠️ --skip-build 供 Jenkins 流水线用：Build stage 已经跑过 `pnpm build:deploy`，
#    这里再跑一次会白白多花几分钟。手工发布时**不要**加这个参数。
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

SKIP_BUILD=0
for arg in "$@"; do
    case "$arg" in
        --skip-build) SKIP_BUILD=1 ;;
        *) echo "未知参数：$arg" >&2; exit 1 ;;
    esac
done

# ── 前置条件（构建期环境变量，缺一不可）──────────────────────────────────
#   NEXT_PUBLIC_SITE_URL          站点对外地址（canonical / sitemap / og:url）
#   NEXT_PUBLIC_SUPABASE_URL      Supabase 项目地址
#   NEXT_PUBLIC_SUPABASE_ANON_KEY anon 公开 key
#
# ⚠️ 这三个都是 NEXT_PUBLIC_ 前缀 → **构建期内联**进产物。
#    只在服务器上设运行时变量**不生效**，改域名必须重新构建。
#
# ⚠️ 绝不要把 SUPABASE_SERVICE_ROLE_KEY 传进构建环境：
#    它虽不带 NEXT_PUBLIC_ 前缀（不会内联进浏览器产物），但仍会出现在
#    构建日志 / CI 环境里。它是**运行时**变量，只放服务器 /etc/jizhi.env。
#
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

OUT_DIR="release"
RELEASE_ID="${RELEASE_ID:-$(git rev-parse --short=12 HEAD)-$(date -u +%Y%m%dT%H%M%SZ)}"
TARBALL="$OUT_DIR/jizhi-$RELEASE_ID.tar.gz"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

# 原生依赖必须来自与 Rocky 服务器同架构的 Linux 构建环境。
[ "$(uname -s)" = Linux ] && [ "$(node -p 'process.platform')" = linux ] || die "生产包必须在 Linux 构建；Mac 仅用于验证"
[[ "$RELEASE_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]] || die "非法 RELEASE_ID"
[ "${NEXT_DIST_DIR:-.next}" = .next ] || die "生产发布使用默认 .next；自定义目录仅用于隔离验证"

# ── 0. 环境自检：构建期变量必须在（否则产物里就是错的域名/错的数据源）──
missing=()
for v in NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do
    [ -n "${!v:-}" ] || missing+=("$v")
done
if [ ${#missing[@]} -gt 0 ]; then
    die "缺少构建期环境变量：${missing[*]}
构建期变量必须在这台机器上设置好再执行本脚本。
在 Jenkins 里请配置为构建参数 / 凭据，而不是服务器上的环境变量。"
fi

# ── 1. 构建（standalone）──────────────────────────────────────────────────
# next.config.ts 读 NEXT_OUTPUT_STANDALONE=1 才开 output: 'standalone'。
# pnpm build:deploy 就是这个环境变量 + next build 的封装。
if [ "$SKIP_BUILD" -eq 1 ]; then
    log "跳过构建（--skip-build），复用已有 .next 产物"
    [ -d ".next/standalone" ] || die "没有 .next/standalone —— 请先跑 pnpm build:deploy，或去掉 --skip-build"
else
    log "构建 standalone 产物"
    pnpm build:deploy
fi

# ── 2. 组装（带完整性校验）───────────────────────────────────────────────
# prepare-deploy.mjs 会逐项校验 server.js / OG 字体 / .next/static / public，
# 缺件直接非零退出。这些缺件在线上都不报错，只会表现成「整站白屏」
# 或「分享图中文变豆腐块」。
log "组装自包含 deploy/ 目录"
pnpm prepare:deploy

# ── 3. 打包 ──────────────────────────────────────────────────────────────
mkdir -p "$OUT_DIR"
[ ! -e "$TARBALL" ] || die "发布包已存在，请使用新的 RELEASE_ID"
RELEASE_ID="$RELEASE_ID" node --input-type=module <<'JS'
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
writeFileSync('deploy/RELEASE-METADATA.json', JSON.stringify({
  releaseId: process.env.RELEASE_ID,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(),
  platform: process.platform, arch: process.arch, nodeVersion: process.versions.node,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL, builtAt: new Date().toISOString(),
}, null, 2) + '\n');
JS

# tar 内层是 deploy/ 的**内容**（不是 deploy/ 这一层），
# 服务器解包后直接就是 server.js 所在目录。
# 用 `-C deploy .` 保证隐藏目录 .next 也被包含进去。
#
# 排除 macOS 垃圾文件：.DS_Store / ._* / __MACOSX。
# 它们会被 prepare-deploy 从工作区的 public/ 原样拷进产物，
# 混进线上包虽然无害，但会让「同一个 commit 打出两个不同 sha256 的包」——
# 校验和对比失去意义。
log "打包 → $TARBALL"
tar -czf "$TARBALL" \
    --exclude='.env' \
    --exclude='.env.*' \
    --exclude='.DS_Store' \
    --exclude='._*' \
    --exclude='__MACOSX' \
    -C deploy .

# 写入发布元信息，便于服务器侧排障时确认版本
cat > "$OUT_DIR/RELEASE-$RELEASE_ID.txt" <<EOF
release_id=$RELEASE_ID
commit=$(git rev-parse HEAD)
branch=$(git rev-parse --abbrev-ref HEAD)
built_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
site_url=${NEXT_PUBLIC_SITE_URL}
EOF

( cd "$OUT_DIR" && sha256sum "$(basename "$TARBALL")" > "$(basename "$TARBALL").sha256" )

# ── 4. 自检：包里必须真的有入口与静态资源 ────────────────────────────────
log "校验包内容"
CONTENTS="$OUT_DIR/CONTENTS-$RELEASE_ID.txt"
tar -tzf "$TARBALL" > "$CONTENTS" || die "生成的 tar 包损坏"
for must in "./server.js" "./.next/static/" "./public/" "./RELEASE-METADATA.json"; do
    grep -Fxq -- "$must" "$CONTENTS" || die "包里缺少 $must —— 不能发布"
done
if grep -Eq '(^|/)\.env(\.[^/]*)?(/|$)' "$CONTENTS"; then
    die "发布包中检测到环境文件"
fi

SIZE_MB=$(du -m "$TARBALL" | cut -f1)
log "完成：${TARBALL}（${SIZE_MB} MB）"
log "下一步：把 tar 包 + scripts/deploy-release.sh 传到 Rocky 服务器执行 deploy-release.sh"
