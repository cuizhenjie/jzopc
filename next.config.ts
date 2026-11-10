import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  /**
   * 裸机部署产物（standalone）。
   *
   * 只在**部署构建**时开启：`NEXT_OUTPUT_STANDALONE=1 pnpm build`。
   * 产物是 `.next/standalone/`（自带最小 node_modules + 运行时字体），
   * 服务器上只需要 node ≥20，不需要 pnpm、不需要源码。
   *
   * 为什么用环境变量而不是写死：写死后 `next start` 会直接报错退出
   * （「next start does not work with output: standalone」），
   * 本地开发与响应式审计都依赖 `pnpm start`，会被一起打断。
   */
  output: process.env.NEXT_OUTPUT_STANDALONE === '1' ? 'standalone' : undefined,
  poweredByHeader: false,
  compress: true,
  // 上级目录存在其他 lockfile，显式指定工作区根，避免 tracing 警告
  outputFileTracingRoot: import.meta.dirname,
  // OG 图渲染中文字体是用 readFile 读的，不在模块图里，
  // 必须显式声明才会被打进部署产物，否则线上会退化成 next/og 的拉丁字体（中文豆腐块）。
  outputFileTracingIncludes: {
    '/api/og': ['./src/app/api/og/fonts/**/*'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.public.blob.storage.windows.net' },
    ],
  },
  experimental: {
    optimizePackageImports: ['framer-motion'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
  /**
   * 旧路由收敛表（2026-11-10 全站复刻对齐参考站后）。
   *
   * 公开站的路由 slug 已改为与参考站一致（/health、/growth、/academy、/news…），
   * 旧链接一律 308 到正式路由，老链接不落 404、也不产生重复内容。
   */
  async redirects() {
    return [
      // 集智商学院
      { source: '/center', destination: '/academy', permanent: true },
      // 流量赋能
      { source: '/traffic', destination: '/growth', permanent: true },
      // 社区动态
      { source: '/newslist', destination: '/news', permanent: true },
      { source: '/activitylist', destination: '/news', permanent: true },
      // 申请入驻（参考站 join.html → 站内 /apply）
      { source: '/join', destination: '/apply', permanent: true },
      // 供需市场 → 供需发布
      { source: '/orders', destination: '/market', permanent: true },
      // 旧版原生页
      { source: '/agents', destination: '/agent', permanent: true },
      { source: '/agents/:slug', destination: '/agent', permanent: true },
      { source: '/academy/courses/:slug', destination: '/academy', permanent: true },
      { source: '/market/:slug', destination: '/market', permanent: true },
      { source: '/news/opc-:id(\\d+)', destination: '/newsdetail?id=:id', permanent: true },
      // ⚠️ 必须用 `:slug+`（一段及以上）而不是 `:slug*`（可为空）——
      // 否则 `/news` 会被本条规则匹配到并 308 到自身，形成重定向环。
      { source: '/news/:slug+', destination: '/news', permanent: true },
    ];
  },
};

export default nextConfig;
