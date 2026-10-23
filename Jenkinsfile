// 集智 AI OPC 官网 · Jenkins 声明式流水线
//
// 完整说明见 docs/16-部署与CI指南.md §5。
//
// ── Jenkins 侧需要先准备的东西 ───────────────────────────────────────────
// 凭据（Credentials）：
//   jizhi-deploy-ssh        SSH 私钥（Username with private key）
//   jizhi-supabase-url      Secret text：Supabase 项目 URL
//   jizhi-supabase-anon-key Secret text：Supabase anon key
//
// 构建参数（首次运行后会自动出现在「Build with Parameters」里）：
//   NEXT_PUBLIC_SITE_URL    站点对外地址（改域名 = 改这个 = 重新构建）
//   DEPLOY_HOST             Rocky 服务器地址
//   DEPLOY_USER             SSH 用户（root 或专用 deploy 用户）
//   DEPLOY_DIR              部署根目录，默认 /opt/jizhi
//   SKIP_TESTS              跳过测试（仅用于应急发布，别常用）
//   SKIP_DEPLOY              只构建不发布（用于验证构建机环境）
//
// ── 构建机要求 ───────────────────────────────────────────────────────────
//   Node.js ≥ 22.15（pnpm test 依赖 Node 原生 TS 类型剥离，22.15 以下跑不了）
//   pnpm 12（由 package.json 的 packageManager 字段锁定，corepack 自动对齐）
//   内存 ≥ 2GB（next build 会吃内存；3D/Shader 依赖多，4GB 更稳）
//
// ── 为什么构建期变量和运行时变量要分开 ─────────────────────────────────
//   NEXT_PUBLIC_*  → 构建期内联进产物 → 必须在**构建机**上注入
//   SUPABASE_SERVICE_ROLE_KEY / OPS_TOKEN / RESEND_API_KEY 等
//                  → 运行时读取 → 只放服务器 /etc/jizhi.env
//   搞混的后果：改域名只改服务器变量 → 线上 canonical 还是旧域名；
//              或者把 service_role 塞进构建环境 → 密钥进 CI 日志。

pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()          // 并发发布会互相切 symlink
        timeout(time: 60, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    parameters {
        string(
            name: 'NEXT_PUBLIC_SITE_URL',
            defaultValue: 'https://t.3cool.cc',
            description: '站点对外地址。NEXT_PUBLIC_* 是构建期内联，改这里必须重新构建。'
        )
        string(
            name: 'DEPLOY_HOST',
            defaultValue: '',
            description: 'Rocky 服务器地址（IP 或域名）'
        )
        string(
            name: 'DEPLOY_USER',
            defaultValue: 'root',
            description: 'SSH 用户。root 或在 sudoers 里配了 NOPASSWD 的专用 deploy 用户'
        )
        string(
            name: 'DEPLOY_DIR',
            defaultValue: '/opt/jizhi',
            description: '部署根目录'
        )
        booleanParam(
            name: 'SKIP_TESTS',
            defaultValue: false,
            description: '跳过 typecheck / test / verify（仅应急发布）'
        )
        booleanParam(
            name: 'SKIP_DEPLOY',
            defaultValue: false,
            description: '只构建打包，不发布到服务器'
        )
    }

    environment {
        // Node ≥22.15 是硬门槛：pnpm test 靠 Node 原生 TS 类型剥离
        NODE_REQUIRED_MAJOR = '22'
        NODE_REQUIRED_MINOR = '15'
        PNPM_VERSION        = '12.11.2'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
                // 私有仓库需要在 job 的 SCM 配置里填 GitHub 凭据；
                // 公开仓库留空即可。
                sh 'git rev-parse --short=12 HEAD'
            }
        }

        stage('Toolchain') {
            steps {
                sh '''
                    set -euo pipefail
                    command -v node >/dev/null 2>&1 || { echo "构建机缺 Node.js，请先安装 22 LTS"; exit 1; }
                    NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
                    NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
                    if [ "$NODE_MAJOR" -lt "$NODE_REQUIRED_MAJOR" ] || \
                       { [ "$NODE_MAJOR" -eq "$NODE_REQUIRED_MAJOR" ] && [ "$NODE_MINOR" -lt "$NODE_REQUIRED_MINOR" ]; }; then
                        echo "需要 Node >= ${NODE_REQUIRED_MAJOR}.${NODE_REQUIRED_MINOR}，当前 $(node -v)"
                        echo "（pnpm test 依赖 Node 原生 TypeScript 类型剥离）"
                        exit 1
                    fi
                    node -v

                    # pnpm 版本由 package.json 的 packageManager 锁定，这里只负责启用 corepack
                    command -v corepack >/dev/null 2>&1 && corepack enable || true
                    if ! command -v pnpm >/dev/null 2>&1; then
                        npm install -g "pnpm@${PNPM_VERSION}"
                    fi
                    pnpm -v
                '''
            }
        }

        stage('Install') {
            steps {
                sh 'pnpm install --frozen-lockfile'
            }
        }

        stage('Verify') {
            when { expression { !params.SKIP_TESTS } }
            steps {
                sh '''
                    set -euo pipefail
                    pnpm typecheck
                    pnpm verify
                    pnpm test
                '''
            }
        }

        stage('Build') {
            steps {
                withCredentials([
                    string(credentialsId: 'jizhi-supabase-url',      variable: 'SB_URL'),
                    string(credentialsId: 'jizhi-supabase-anon-key', variable: 'SB_ANON'),
                ]) {
                    sh '''
                        set -euo pipefail
                        # 构建期变量：Next 会把它们内联进产物。
                        # 这里做一次显式回显校验（只回显是否存在，不回显 key 内容）。
                        for v in NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do
                            if [ -z "${!v:-}" ]; then
                                echo "构建期变量 $v 为空 —— 会导致产物里是错的域名/错的数据源"
                                exit 1
                            fi
                        done
                        export NEXT_PUBLIC_SUPABASE_URL="$SB_URL"
                        export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SB_ANON"
                        pnpm build:deploy
                    '''
                }
            }
        }

        stage('Package') {
            steps {
                // --skip-build：Build stage 已经构建过了，这里只组装打包，避免构建两次
                sh 'bash scripts/build-release.sh --skip-build'
                // 存档发布包：Jenkins 上直接下载即可手工回滚
                archiveArtifacts artifacts: 'release/*', fingerprint: true, onlyIfSuccessful: true
            }
        }

        stage('Deploy') {
            when {
                expression { !params.SKIP_DEPLOY && params.DEPLOY_HOST?.trim() }
            }
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: 'jizhi-deploy-ssh',
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER',
                    ),
                ]) {
                    sh '''
                        set -euo pipefail
                        SHA="$(git rev-parse --short=12 HEAD)"
                        TARBALL="release/jizhi-$SHA.tar.gz"
                        [ -f "$TARBALL" ] || { echo "找不到 $TARBALL"; exit 1; }

                        # 首次连接时记录主机指纹（严格模式下这一步是必要的）
                        mkdir -p "$HOME/.ssh"
                        ssh-keyscan -H "$DEPLOY_HOST" >> "$HOME/.ssh/known_hosts" 2>/dev/null || true

                        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new \
                            "$DEPLOY_USER@$DEPLOY_HOST" 'mkdir -p /tmp/jizhi-release && chmod 755 /tmp/jizhi-release'

                        scp -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new \
                            "$TARBALL" "$TARBALL.sha256" scripts/deploy-release.sh \
                            "$DEPLOY_USER@$DEPLOY_HOST:/tmp/jizhi-release/"

                        # sudo -n：发布脚本需要写 /opt/jizhi 与重启 systemd。
                        # 若用 root 直连且系统无 sudo，把 sudo -n 去掉即可。
                        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new \
                            "$DEPLOY_USER@$DEPLOY_HOST" \
                            "sudo -n bash /tmp/jizhi-release/deploy-release.sh \
                             '/tmp/jizhi-release/jizhi-$SHA.tar.gz' '$SHA' '$DEPLOY_DIR'"
                    '''
                }
            }
        }

        stage('Smoke') {
            when {
                expression { !params.SKIP_DEPLOY && params.DEPLOY_HOST?.trim() }
            }
            steps {
                sh '''
                    set -euo pipefail
                    SITE="${NEXT_PUBLIC_SITE_URL%/}"
                    echo "外网冒烟：$SITE"
                    curl -fsS --max-time 15 -o /dev/null -w '  /            -> %{http_code}\n' "$SITE/"
                    curl -fsS --max-time 15 -o /dev/null -w '  /robots.txt  -> %{http_code}\n' "$SITE/robots.txt"
                    # /api/leads 只收 POST，GET 返回 405 是预期结果 → 证明 API 路由活着
                    CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$SITE/api/leads" || echo 000)"
                    echo "  /api/leads   -> ${CODE}（预期 405）"
                    [ "$CODE" = "405" ] || { echo "API 路由异常，发布可能不完整"; exit 1; }
                '''
            }
        }
    }

    post {
        success {
            echo "发布成功：${params.NEXT_PUBLIC_SITE_URL}（${env.BUILD_TAG}）"
        }
        failure {
            echo """
发布失败。排障顺序：
  1. 看 Jenkins 日志里失败在哪个 stage（Verify / Build / Deploy / Smoke）
  2. Deploy 阶段失败 → 登录服务器：journalctl -u jizhi -n 200 --no-pager
  3. 发布脚本会自动回滚到上一个版本；确认现状：
       ls -l /opt/jizhi/current
  4. 需要手工回滚时，从 Jenkins 构建记录下载 release/jizhi-<sha>.tar.gz，
     传到服务器执行 scripts/deploy-release.sh 即可。
"""
        }
        always {
            // 清理构建机上的临时发布包（已 archiveArtifacts 存档）
            sh 'rm -rf release || true'
        }
    }
}
