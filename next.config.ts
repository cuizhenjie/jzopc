import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
};

export default nextConfig;
