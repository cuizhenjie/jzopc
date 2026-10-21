/**
 * 裸机部署的进程守护配置（pm2）。
 *
 * 任何进程守护工具都能用（pm2 / pm2-systemd / screen / nohup），
 * 这里给出 pm2 的配置作为最省事的一种：
 *
 *   cd deploy && pm2 start pm2.config.cjs && pm2 save
 *
 * ## 为什么只有 1 个实例
 *
 * 页面的 ISR 再生成缓存写在**本地磁盘** `.next/cache` 里
 * （`/search`、`/traffic` 等页是 `revalidate = 600`）。
 * 多实例各写各的缓存 → 同一份内容被重复生成、内容更新也不一致。
 * 单实例 + 单进程是当前架构下的正确选择；真要横向扩容，
 * 需先把 ISR 缓存换成共享存储（Vercel 那套托管方案自带）。
 *
 * ## 环境变量去哪了
 *
 * `NEXT_PUBLIC_*` 已在**构建期**内联进产物（见 next.config.ts 的说明），
 * 这里只放**运行时**变量：服务端密钥与端口。
 * 密钥建议放在服务器的 `/etc/jizhi.env`，用 `env_file` 或
 * `pm2 start --env` 注入，**不要**写进这个文件。
 */
module.exports = {
  apps: [
    {
      name: 'jizhi',
      script: 'server.js',
      cwd: __dirname,
      // ISR 缓存是本地磁盘 → 单实例（见上方说明）
      instances: 1,
      exec_mode: 'cluster',
      autorestart: true,
      max_memory_restart: '1G',
      // 优雅重启：新进程起来再停旧的，避免发布瞬间 502
      wait_ready: false,
      kill_timeout: 5000,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // 只监听本机回环，由前置代理对外（没有代理时改成 0.0.0.0）
        HOSTNAME: '127.0.0.1',
      },
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
