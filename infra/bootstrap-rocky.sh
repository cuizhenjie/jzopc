#!/usr/bin/env bash
#
# 集智 AI OPC 官网 · Rocky Linux 9 首次初始化
#
# 用法（以 root 执行）：
#   bash infra/bootstrap-rocky.sh
#
# 幂等：可重复执行，不会破坏已部署的版本与 /etc/jizhi.env。
#
# 本脚本做四件事：
#   1. 装 Node.js 22 LTS（生产进程只需 node ≥20，22 与构建机一致更稳）
#   2. 建系统用户 jizhi + 目录骨架 /opt/jizhi/{releases,current}
#   3. 装 systemd 单元
#   4. 处理 Rocky 专属坑：SELinux 阻断 nginx→本机 3000 端口、firewalld 放行
#
# ⚠️ 它**不碰** nginx 配置（域名与证书路径因站而异，见 infra/nginx/jizhi.conf）
#    也**不碰** /etc/jizhi.env（密钥由你手工填写，脚本不会覆盖已有内容）。
#
set -euo pipefail

NODE_MAJOR=22
APP_DIR=/opt/jizhi
APP_USER=jizhi
SERVICE_FILE=/etc/systemd/system/jizhi.service
ENV_FILE=/etc/jizhi.env
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "请用 root 执行：bash infra/bootstrap-rocky.sh"

# ── 1. Node.js ────────────────────────────────────────────────────────────
if command -v node >/dev/null 2>&1 && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ]; then
    log "Node.js 已安装：$(node -v)"
else
    log "安装 Node.js ${NODE_MAJOR} LTS（NodeSource）"
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    dnf install -y nodejs
    node -v
fi

# ── 2. 用户与目录 ─────────────────────────────────────────────────────────
if ! id -u "$APP_USER" >/dev/null 2>&1; then
    log "创建系统用户 ${APP_USER}"
    useradd --system --home-dir "$APP_DIR" --shell /sbin/nologin "$APP_USER"
fi

log "准备目录 ${APP_DIR}"
install -d -o "$APP_USER" -g "$APP_USER" -m 0755 "$APP_DIR" "$APP_DIR/releases"

# ── 3. 运行时密钥文件 ─────────────────────────────────────────────────────
# 只创建骨架，绝不覆盖已有内容（里面是 service_role key / OPS_TOKEN）。
if [ ! -f "$ENV_FILE" ]; then
    log "创建 ${ENV_FILE} 骨架（请随后手工填入真实值）"
    cat > "$ENV_FILE" <<'EOF'
# 集智 AI OPC 官网 · 运行时环境变量
#
# ⚠️ 这里只放**运行时读取**的变量（服务端密钥）。
#    带 NEXT_PUBLIC_ 前缀的变量是**构建期内联**的，必须在 Jenkins 构建阶段注入，
#    放到这里不生效（详见 docs/16-部署与CI指南.md §3）。
#
# 权限：600，属主 root:jizhi（root 可读、jizhi 组可读）
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1

# Supabase service_role（绝不可加 NEXT_PUBLIC_ 前缀）
SUPABASE_SERVICE_ROLE_KEY=

# 后台 OPS_TOKEN 恢复主口令（留空 = 关闭该兜底通道）
OPS_TOKEN=

# 新线索通知（webhook / 邮件）
LEAD_NOTIFY_WEBHOOK=
LEAD_NOTIFY_EMAIL_TO=
LEAD_NOTIFY_EMAIL_FROM=
RESEND_API_KEY=
EOF
fi
chown root:"$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"
warn "已就绪：$ENV_FILE —— 请填入真实密钥后 systemctl restart jizhi"

# ── 4. systemd 单元 ───────────────────────────────────────────────────────
if [ -f "$REPO_ROOT/infra/systemd/jizhi.service" ]; then
    log "安装 systemd 单元"
    install -m 0644 "$REPO_ROOT/infra/systemd/jizhi.service" "$SERVICE_FILE"
else
    warn "未找到 infra/systemd/jizhi.service，请手工安装到 $SERVICE_FILE"
fi
systemctl daemon-reload
systemctl enable jizhi >/dev/null 2>&1 || warn "enable 失败（首次部署前应用还没上线，可忽略）"

# ── 5. Rocky 专属：SELinux ────────────────────────────────────────────────
# nginx 反代到 127.0.0.1:3000 会被 SELinux 拦截：
# httpd 只能连 http_port_t 里的端口（80/443），3000 不在其中。
# 症状是「nginx 502 bad gateway，日志里 permission denied」——不是应用的问题。
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" != "Disabled" ]; then
    if getsebool httpd_can_network_connect 2>/dev/null | grep -q '--> off'; then
        log "放行 SELinux：nginx → 后端端口"
        setsebool -P httpd_can_network_connect 1
    else
        log "SELinux：httpd_can_network_connect 已开启"
    fi
    # 若服务日志出现对 /opt/jizhi 的权限拒绝，再执行：
    #   semanage fcontext -a -t var_lib_t "/opt/jizhi(/.*)?"
    #   restorecon -Rv /opt/jizhi
    warn "若 jizhi 服务报 SELinux 拒绝，执行上面两行 semanage/restorecon"
fi

# ── 6. Rocky 专属：firewalld ──────────────────────────────────────────────
if systemctl is-active --quiet firewalld; then
    log "firewalld 放行 80/443"
    firewall-cmd --permanent --add-service=http  >/dev/null
    firewall-cmd --permanent --add-service=https >/dev/null
    firewall-cmd --reload >/dev/null
else
    warn "firewalld 未运行，如已启用请手工放行 80/443"
fi

# ── 7. nginx ──────────────────────────────────────────────────────────────
if [ -f "$REPO_ROOT/infra/nginx/jizhi.conf" ]; then
    log "提示：nginx 配置在 $REPO_ROOT/infra/nginx/jizhi.conf"
    warn "请先改好 server_name / 证书路径，再执行："
    warn "  install -m 0644 $REPO_ROOT/infra/nginx/jizhi.conf /etc/nginx/conf.d/jizhi.conf"
    warn "  nginx -t && systemctl reload nginx"
else
    warn "未找到 infra/nginx/jizhi.conf"
fi

cat <<EOF

✅ 初始化完成。接下来：

  1. 填密钥：  vi $ENV_FILE
  2. 装 nginx： install -m 0644 $REPO_ROOT/infra/nginx/jizhi.conf /etc/nginx/conf.d/jizhi.conf
                nginx -t && systemctl reload nginx
  3. 首次发布： 见 docs/16-部署与CI指南.md §4（手工发布）或 §5（Jenkins CI）

EOF
