#!/usr/bin/env bash
# Rocky 9 应用机初始化；Nginx 和 TLS 在外层跳板机管理。
# sudo env PROXY_IP=192.168.10.230 FIREWALL_ZONE=public \
#   NODE_BIN=/data/app-home/toolchain/node22/bin/node bash infra/bootstrap-rocky.sh
set -euo pipefail

APP_DIR=/data/app-home/jizhi
APP_USER=jizhi
ENV_FILE=/etc/jizhi.env
NODE_BIN="${NODE_BIN:-/usr/bin/node}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() { printf '错误：%s\n' "$*" >&2; exit 1; }
log() { printf '==> %s\n' "$*"; }

# 所有前置条件先检查，避免配置不完整时修改共享服务器。
[ "$(id -u)" -eq 0 ] || die '请使用 sudo/root 执行本脚本'
[ -r /etc/os-release ] || die '无法识别操作系统'
. /etc/os-release
[ "$ID" = rocky ] && [[ "$VERSION_ID" == 9* ]] || die '仅支持 Rocky Linux 9'
[[ "$NODE_BIN" =~ ^/[a-zA-Z0-9_./-]+$ ]] || die 'NODE_BIN 必须为不含空格的绝对路径'
[ -x "$NODE_BIN" ] || die "找不到 Node：$NODE_BIN；请先安装独立 Node 22.18+"
"$NODE_BIN" -e 'const [major,minor]=process.versions.node.split(".").map(Number); process.exit((major===22 && minor>=18) || major===24 ? 0 : 1)' \
    || die '需要 Node 22.18+（22.x）或 Node 24.x；不会自动升级系统共享 Node'

PROXY_IP="${PROXY_IP:-}"
FIREWALL_ZONE="${FIREWALL_ZONE:-}"
[[ "$PROXY_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || die '必须显式指定跳板机实际来源 PROXY_IP（IPv4）'
IFS=. read -r -a octets <<< "$PROXY_IP"
for octet in "${octets[@]}"; do
    (( 10#$octet <= 255 )) || die 'PROXY_IP 不是有效 IPv4'
    [ "$octet" = "$((10#$octet))" ] || die 'PROXY_IP 不允许前导零'
done
(( octets[0] > 0 && octets[0] < 224 && octets[0] != 127 )) || die 'PROXY_IP 必须是有效的非回环单播地址'
[[ "$FIREWALL_ZONE" =~ ^[a-zA-Z0-9_-]+$ ]] || die '必须指定应用网卡所在 FIREWALL_ZONE'
command -v firewall-cmd >/dev/null || die '需要已配置并运行的 firewalld'
systemctl is-active --quiet firewalld || die 'firewalld 未运行；请先确认 SSH 等现有服务规则，再启动防火墙'
firewall-cmd --state >/dev/null || die 'firewalld 不可用'
active_zones="$(firewall-cmd --get-active-zones | awk '/^[^[:space:]]/{print $1}')"
grep -Fx -- "$FIREWALL_ZONE" <<< "$active_zones" >/dev/null || die "zone $FIREWALL_ZONE 未启用；请查看 firewall-cmd --get-active-zones"
[ -f "$REPO_ROOT/infra/jizhi.env.example" ] || die '缺少 infra/jizhi.env.example'
[ -f "$REPO_ROOT/infra/systemd/jizhi.service" ] || die '缺少 systemd 服务模板'
[ ! -L "$ENV_FILE" ] || die "$ENV_FILE 不得为符号链接"
if [ -e "$ENV_FILE" ]; then
    [ -f "$ENV_FILE" ] || die "$ENV_FILE 必须为普通文件"
    # 不 source 含密钥的文件；只读取网络配置，最后一个同名值生效。
    for setting in HOSTNAME PORT; do
        value="$(awk -F= -v key="$setting" '$1 == key {value=substr($0,length(key)+2)} END {print value}' "$ENV_FILE")"
        value="${value%\"}"; value="${value#\"}"
        value="${value%\'}"; value="${value#\'}"
        expected=0.0.0.0
        [ "$setting" != PORT ] || expected=4000
        [ -z "$value" ] || [ "$value" = "$expected" ] || die "$ENV_FILE 的 $setting 会覆盖 systemd；请先手工设为 $expected，再重试（保留其他密钥）"
    done
fi

log "Node：$("$NODE_BIN" --version)，应用目录：$APP_DIR"
if ! id -u "$APP_USER" >/dev/null 2>&1; then
    useradd --system --home-dir "$APP_DIR" --shell /sbin/nologin "$APP_USER"
fi
install -d -o root -g root -m 0755 "$APP_DIR" "$APP_DIR/releases"
if [ ! -e "$ENV_FILE" ]; then
    install -o root -g "$APP_USER" -m 0600 "$REPO_ROOT/infra/jizhi.env.example" "$ENV_FILE"
fi
chown root:"$APP_USER" "$ENV_FILE"
chmod 0600 "$ENV_FILE"

# 只操作指定 zone 的应用端口。分别写运行时和持久规则，不 reload 其他业务规则。
allow_rule="rule priority=\"-20\" family=\"ipv4\" source address=\"$PROXY_IP/32\" port port=\"4000\" protocol=\"tcp\" accept"
drop_rule='rule priority="-10" family="ipv4" port port="4000" protocol="tcp" drop'
for scope in runtime permanent; do
    flags=()
    [ "$scope" != permanent ] || flags=(--permanent)
    firewall-cmd "${flags[@]}" --zone="$FIREWALL_ZONE" --add-rich-rule="$allow_rule" >/dev/null
    firewall-cmd "${flags[@]}" --zone="$FIREWALL_ZONE" --add-rich-rule="$drop_rule" >/dev/null
done

unit_tmp="$(mktemp)"
trap 'rm -f "$unit_tmp"' EXIT
sed "s|^ExecStart=/usr/bin/node |ExecStart=$NODE_BIN |" "$REPO_ROOT/infra/systemd/jizhi.service" > "$unit_tmp"
install -o root -g root -m 0644 "$unit_tmp" /etc/systemd/system/jizhi.service
systemctl daemon-reload
systemctl enable jizhi
log "初始化完成。请填写 $ENV_FILE 后构建并发布；本脚本不会启动或重启应用。"
log "请核验 $FIREWALL_ZONE 规则及实际连通性：仅跳板机 $PROXY_IP 应能访问 192.168.10.179:4000。"
