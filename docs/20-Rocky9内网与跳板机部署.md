# Rocky 9 内网应用 + 外层 Nginx 部署

本方案对应 `https://www.jizhiai.net.cn`：外层跳板机提供 HTTPS，内部 Rocky 9 运行 Next.js standalone。应用需要 Node 和现有 Supabase 服务，不能导出纯静态 HTML 代替。

| 项目 | 配置 |
|---|---|
| GitLab | `https://gitlab.jimei.cn/jmtxl/jizhi-website.git`，分支 `main` |
| 应用机 | Rocky Linux 9，`192.168.10.179`，x86_64 |
| 应用监听 | IPv4 `0.0.0.0:4000`，不占用已有的 3000 端口 |
| 跳板机内网地址 | `192.168.10.230`；防火墙以应用机实际看到的代理来源为准 |
| 应用目录 | `/data/app-home/jizhi`，版本目录 `releases/`，当前链接 `current` |
| 运行用户 / 服务 | `jizhi` / `jizhi.service` |
| 运行时配置 | `/etc/jizhi.env`，`root:jizhi`、`0600` |
| 独立 Node | `/data/app-home/toolchain/node22/bin/node`，Node 22.18+ |
| 防火墙 | `public` zone、`ens160`；只新增本站 4000/tcp 规则 |

现有系统 Node 20 和其他 Docker 服务继续使用原来的环境。本站通过独立 Node 路径启动。以下命令区分应用机和跳板机；不能把 Nginx 配置安装到应用机代替跳板机配置。历史 `docs/16-部署与CI指南.md` 和 Jenkinsfile 的同机代理示例不适用于本方案，本次使用手工发布流程。

## 1. 应用机：准备工具与独立 Node

已有独立 Node 时直接检查版本，跳过安装。新安装使用 Node 官方 Linux x64 包；不能上传 Mac 的 `node_modules`、`.next` 或 `deploy/` 直接运行。

```bash
sudo dnf install -y git curl tar xz gzip python3 util-linux

# 只在独立 node22 目录尚未创建时执行；不要覆盖正在使用的工具链。
node_stage="$(mktemp -d)"
cd "$node_stage"
curl -fSLO https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt
node_archive="$(awk '$2 ~ /^node-v22\.[0-9]+\.[0-9]+-linux-x64\.tar\.xz$/ {print $2}' SHASUMS256.txt)"
test -n "$node_archive"
curl -fSLO "https://nodejs.org/dist/latest-v22.x/$node_archive"
awk -v file="$node_archive" '$2 == file' SHASUMS256.txt > node.sha256
sha256sum -c node.sha256
sudo install -d -m 0755 /data/app-home/toolchain
sudo mkdir /data/app-home/toolchain/node22
sudo tar -xJf "$node_archive" --strip-components=1 -C /data/app-home/toolchain/node22

export PATH="/data/app-home/toolchain/node22/bin:$HOME/.local/bin:$PATH"
node --version
# 由部署账号安装 pnpm，不替换系统 npm/node。
npm install --global --prefix "$HOME/.local" pnpm@12.11.2
pnpm --version
```

Node 校验需达到 22.18+；bootstrap 也接受 Node 24.x。若系统 `/usr/bin/node` 已满足要求，可在后续初始化时使用 `NODE_BIN=/usr/bin/node`。独立安装失败或校验不通过时先停止，不继续部署。

## 2. 应用机：拉取源码并初始化

以具有 sudo 权限的部署账号构建源码。GitLab 私有仓库使用本机已配置的凭据或交互认证，不把 Token 写进克隆 URL、脚本和日志。

```bash
mkdir -p "$HOME/src"
cd "$HOME/src"
git clone --branch main https://gitlab.jimei.cn/jmtxl/jizhi-website.git jizhi-website
cd jizhi-website

# 确认实际网卡与活动 zone；本机当前为 public / ens160。
sudo firewall-cmd --get-active-zones
sudo firewall-cmd --zone=public --list-all
sudo env PROXY_IP=192.168.10.230 FIREWALL_ZONE=public \
  NODE_BIN=/data/app-home/toolchain/node22/bin/node \
  bash infra/bootstrap-rocky.sh
```

初始化只创建用户、版本目录、环境模板、systemd 单元，以及指定 zone 的 4000/tcp 规则。它不升级系统 Node、不改 Nginx/SELinux/80/443、不重载 firewalld，也不自动重启应用。

防火墙规则优先级为 `-20` 接受代理 IPv4 来源、`-10` 丢弃其他 IPv4 来源；应用只绑定 IPv4。仍需核验既有 direct/policy/更高优先级规则及其他网卡没有额外开放路径。不要额外执行 `--add-port=4000/tcp`。未来更换代理 IP 时应人工核对并移除旧白名单，脚本不会删除已有规则。

如果 `/etc/jizhi.env` 已存在，脚本保留原内容；若其中 `HOSTNAME` 或 `PORT` 与本方案不符，会要求先手工调整。该文件的变量会覆盖 systemd 中的默认值。

## 3. 应用机：配置数据库及运行时密钥

```bash
sudoedit /etc/jizhi.env
sudo chown root:jizhi /etc/jizhi.env
sudo chmod 600 /etc/jizhi.env
```

按 `infra/jizhi.env.example` 填写：

- `HOSTNAME=0.0.0.0`、`PORT=4000`、`NEXT_PUBLIC_SITE_URL=https://www.jizhiai.net.cn`。
- 现有生产 Supabase 的 URL、anon key 和 `SUPABASE_SERVICE_ROLE_KEY`。后台、动态内容和留资依赖该数据库；仅安装 Node 不会自动创建或迁移数据库。
- `OPS_TOKEN` 为可选后台恢复口令；留空则使用已有管理员账号。
- 启用后台上传时填写全部 `S3_*`，S3 endpoint 需能从用户浏览器访问，CORS 需允许 `https://www.jizhiai.net.cn`。
- 需要通知时填写 `LEAD_NOTIFY_*` / `RESEND_API_KEY`。

配置格式是 `KEY=value`，不要加 `export`。不要 `source /etc/jizhi.env` 来构建，也不要把服务端密钥放到 `NEXT_PUBLIC_*` 变量中。数据库使用既有实例时先确认迁移版本和管理员账号，不能为部署而重新灌种子或覆盖线上数据。

## 4. 应用机：构建并发布

每次新 shell 先设置独立工具链 PATH。在源码目录执行，三个公共变量必须与运行时配置一致。只有公共变量进入构建环境；服务器密钥由 systemd 单独读取。

```bash
export PATH="/data/app-home/toolchain/node22/bin:$HOME/.local/bin:$PATH"
export NEXT_PUBLIC_SITE_URL=https://www.jizhiai.net.cn
export NEXT_PUBLIC_SUPABASE_URL='填写生产 Supabase URL'
export NEXT_PUBLIC_SUPABASE_ANON_KEY='填写生产 anon key'

pnpm install --frozen-lockfile
export RELEASE_ID="$(git rev-parse --short=12 HEAD)-$(date -u +%Y%m%dT%H%M%SZ)"
bash scripts/build-release.sh
pnpm typecheck
pnpm test
# 产出 release/jizhi-$RELEASE_ID.tar.gz 及同名 .sha256；不要遗漏校验文件。

sudo env PATH="/data/app-home/toolchain/node22/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" APP_PORT=4000 \
  bash scripts/deploy-release.sh \
  "$PWD/release/jizhi-$RELEASE_ID.tar.gz" "$RELEASE_ID" /data/app-home/jizhi

sudo systemctl status jizhi --no-pager
sudo journalctl -u jizhi -n 80 --no-pager
curl -fsS http://127.0.0.1:4000/robots.txt
```

干净克隆时先构建，再运行独立类型检查和测试：`next-env.d.ts` 引用的 `.next/types/routes.d.ts` 需要由构建生成，构建本身也执行类型校验。全部检查通过后才发布。

发布命令显式指定独立 Node 的 PATH，避免 sudo 切回系统 Node。发布失败不要反复覆盖同名目录，使用新的唯一 `RELEASE_ID`。脚本会在服务启动或基础 HTTP 探活失败时尝试回滚；首次发布没有旧版本可恢复。

`NEXT_PUBLIC_*` 会在构建时内联，修改域名或数据库地址后必须重新构建，不能只改 `/etc/jizhi.env`。组装与打包会排除 `.env*`，运行时配置不会随发布包传输。

## 5. 跳板机：确认内网连接和证书

在运行现有 Nginx 的跳板机执行：

```bash
curl -fsS -H 'Host: www.jizhiai.net.cn' http://192.168.10.179:4000/robots.txt
curl -s -o /dev/null -w '%{http_code}\n' http://192.168.10.179:4000/api/leads
# GET /api/leads 应为 405；这是只接受 POST 的业务接口。
```

域名 DNS 的 A/AAAA 记录应指向外层 Nginx 的公网入口；仅在 IPv6 公网路径已配置时设置 AAAA。TLS 证书覆盖 `www.jizhiai.net.cn` 和 `jizhiai.net.cn`，证书和私钥只放跳板机。本次核验的证书有效期为 2026-11-10 至 2027-02-07；后续发布应重新检查到期时间。

本次使用跳板机已有证书，正式模板已对应以下路径：

- 证书链：`/usr/local/nginx/conf/ssl/www.jizhiai.net.cn.pem`
- 私钥：`/usr/local/nginx/conf/ssl/www.jizhiai.net.cn.key`

在跳板机核对证书域名、有效期以及公钥匹配；两条摘要应一致，不输出私钥内容：

```bash
sudo openssl x509 -in /usr/local/nginx/conf/ssl/www.jizhiai.net.cn.pem -noout -dates -subject
sudo openssl x509 -in /usr/local/nginx/conf/ssl/www.jizhiai.net.cn.pem -text -noout | sed -n '/X509v3 Subject Alternative Name/{n;p;}'
sudo openssl x509 -in /usr/local/nginx/conf/ssl/www.jizhiai.net.cn.pem -pubkey -noout | openssl pkey -pubin -outform DER | sha256sum
sudo openssl pkey -in /usr/local/nginx/conf/ssl/www.jizhiai.net.cn.key -pubout -outform DER | sha256sum
```

核验通过后直接执行第 6 节，沿用现有证书续期流程。**本次不需要执行下面的 ACME 首次签发步骤，也不需要替换成 HTTP 临时站点。**

### 附加说明：仅供未来无证书的新环境

只有尚无可用证书并决定使用 Let's Encrypt 时，才先安装 HTTP 引导配置，不能提前加载引用不存在证书的 HTTPS 配置：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name www.jizhiai.net.cn;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 503; }
}
```

该域名已有配置时先按第 6 节备份到 `conf.d` 外；仅在确需首次签发且无可用证书时，将 HTTP 引导内容写入现有 `/usr/local/nginx/conf/conf.d/www.jizhiai.net.cn.conf`。配置检查通过后 reload，再使用跳板机已有的 Certbot/ACME 工具签发。例如已安装 Certbot 的环境：

```bash
sudo mkdir -p /var/www/html
sudo /usr/local/nginx/sbin/nginx -t && sudo /usr/local/nginx/sbin/nginx -s reload
sudo certbot certonly --webroot -w /var/www/html -d www.jizhiai.net.cn
```

确保公网 80 可达。证书签发成功后，用正式 `infra/nginx/jizhi.conf` **替换该临时站点文件**，不要同时保留两个同名 `server_name`。DNS-01 或公司证书按原有证书管理流程办理。

## 6. 跳板机：安装正式 Nginx 配置

跳板机的 Nginx 二进制为 `/usr/local/nginx/sbin/nginx`，本域名已有配置 `/usr/local/nginx/conf/conf.d/www.jizhiai.net.cn.conf`。仓库 `infra/nginx/jizhi.conf` 已使用本机现有 `.pem` / `.key` 证书路径；完成第 5 节证书核验后，替换现有文件，不能另建重复域名配置。

```bash
# 在存放仓库正式 jizhi.conf 的目录执行；证书须已通过核验。
# 备份必须放 conf.d 外，避免备份文件也被 Nginx include。
nginx_site=/usr/local/nginx/conf/conf.d/www.jizhiai.net.cn.conf
nginx_backup="/usr/local/nginx/conf/backups/www.jizhiai.net.cn.$(date +%Y%m%dT%H%M%S).conf"
sudo install -d -m 0755 /usr/local/nginx/conf/backups
sudo cp -p "$nginx_site" "$nginx_backup"
sudo install -m 0644 jizhi.conf "$nginx_site"
if sudo /usr/local/nginx/sbin/nginx -t; then
    sudo /usr/local/nginx/sbin/nginx -s reload
else
    sudo cp -p "$nginx_backup" "$nginx_site"
    echo '配置检查失败，已恢复原配置；未 reload。' >&2
fi
```

正式模板匹配当前 Nginx 1.18.0 / OpenSSL 1.0.2k-fips：使用 `listen 443 ssl http2` 和 `ssl_protocols TLSv1.2`，升级支持 TLS 1.3 的 OpenSSL/Nginx 后再开启 TLS 1.3。HTTP 与 HTTPS 都保留 `www.jizhiai.net.cn`、`jizhiai.net.cn`，HTTP 统一跳转到 HTTPS 的 www 地址；保留原有 100m 请求体限制和一条一年期 `includeSubDomains` HSTS 响应头。

正式模板已设置 `192.168.10.179:4000`，所有页面、静态资源、API 和后台都转发给 Node；无需把静态文件复制到跳板机。入口覆盖转发头，保留真实客户端 IP，禁止缓存动态响应并关闭响应缓冲。若 Nginx 前面还有 CDN/LB，需要先配置仅信任该代理来源的 `real_ip`，否则限流会按 CDN 的 IP 聚合。

若跳板机启用 SELinux 且 Nginx 错误日志明确出现连接上游 `Permission denied`，在**跳板机**按现有安全策略允许 httpd 出站，例如 `sudo setsebool -P httpd_can_network_connect 1`。不要在应用机盲目关闭 SELinux。

## 7. 验收、更新与回滚

基础验收：

```bash
# 应用机
sudo ss -lntp 'sport = :4000'
curl -fsS http://127.0.0.1:4000/ >/dev/null
# 跳板机
curl -fsS http://192.168.10.179:4000/robots.txt
# 任意公网客户端
curl -I http://www.jizhiai.net.cn/
curl -I https://www.jizhiai.net.cn/
curl -fsS https://www.jizhiai.net.cn/robots.txt
```

还必须通过浏览器验证首页/新闻等有真实内容、CSS/JS/图片可加载、分享图中文正常、canonical 和 sitemap 使用正式 HTTPS 域名；从正式域名测试后台登录、查询和一次经授权的留资/上传。后台 Cookie 使用 Secure，不能用内网 HTTP 登录成功与否代替 HTTPS 验收。另从非白名单内网客户端验证 4000 不可达。上述 HTTP 检查不会证明数据库写入、后台权限或上传功能已经通过。

更新：在干净源码目录 `git pull --ff-only`，重做第 4 节。发布会保留历史版本，systemd restart 有短暂切换窗口；不承诺零停机。应用改动不自动迁移数据库。

手工回滚先用 `sudo ls -1 /data/app-home/jizhi/releases` 选定已有历史版本，替换下方 `填写已有版本号`。此操作持有与发布脚本相同的锁，不重新解包或覆盖旧目录。数据库不随代码回滚。

```bash
sudo bash <<'ROLLBACK'
set -euo pipefail
app_root=/data/app-home/jizhi
target="$app_root/releases/填写已有版本号"
exec 9>"$app_root/.deploy.lock"
flock -n 9 || { echo '已有发布或回滚正在运行' >&2; exit 1; }
test -f "$target/server.js"
test ! -e "$app_root/current.rollback" || test -L "$app_root/current.rollback"
ln -sfn "$target" "$app_root/current.rollback"
mv -Tf "$app_root/current.rollback" "$app_root/current"
systemctl reset-failed jizhi
systemctl restart jizhi
curl --retry 10 --retry-connrefused --retry-delay 2 -fsS http://127.0.0.1:4000/ >/dev/null
curl -fsS http://127.0.0.1:4000/robots.txt
ROLLBACK
# 随后从跳板机与公网复测，确认旧版本的业务数据和后台功能。
```

故障排查优先看 `journalctl -u jizhi`、跳板机 Nginx error log 和两段 `curl`：内网可达但公网 502 时检查上游地址、代理出站策略和证书配置；首页 200 但内容为空时检查 Supabase 连接和发布状态。

参考：[Next.js 自托管](https://nextjs.org/docs/app/guides/self-hosting)、[Nginx proxy 模块](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)、[Rocky firewalld 文档](https://docs.rockylinux.org/guides/security/firewalld-beginners/)。
