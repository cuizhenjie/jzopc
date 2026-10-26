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
   * 旧版原生页下线表（2026-10-26，站点收敛到复刻 opcstore 的科技蓝版本）。
   *
   * 背景：首版原生站（DB 驱动的 /agents /academy /news /market/[slug]）在复刻层
   * 接管主导航后遗留在线，与复刻页形成同一内容两套 URL（新闻详情还双 canonical
   * 自指，构成重复内容）。这里统一 308 到复刻正主，老链接不落 404。
   *
   * 保留不动：/empower/[slug]、/apply、/traffic（它们是导航正主，不是重复页）；
   * /newslist /activitylist /newsdetail 的 DB 动态渲染与 /admin 后台全部保留。
   *
   * 规则按序匹配：/news/opc-<纯数字> 的正则段必须排在通配 /news/* 之前。
   */
  async redirects() {
    return [
      { source: '/agents', destination: '/agent', permanent: true },
      { source: '/agents/:slug', destination: '/agent', permanent: true },
      { source: '/academy', destination: '/center', permanent: true },
      { source: '/academy/courses/:slug', destination: '/center', permanent: true },
      { source: '/market/:slug', destination: '/market', permanent: true },
      { source: '/news/opc-:id(\\d+)', destination: '/newsdetail?id=:id', permanent: true },
      { source: '/news/:slug*', destination: '/newslist', permanent: true },
    ];
  },
};

export default nextConfig;
