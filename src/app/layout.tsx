import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import '@/styles/public-chrome.css';
// ⚠️ OPC 复刻页的设计层（token + 组件）**不在这里导入**。
//
// 原因有二：
//  1. Next.js 只允许全局 CSS 在根布局 import —— 在 Server Component
//     （ReplicaPage）里 import 会被**静默丢弃**（实测打包后 page.css 里
//     只有 opc-interactions.css，设计层完全没进去）。
//  2. 更重要的是**加载顺序**：手写设计层走 Next.js 的打包链路，
//     原站基线 `public/opc/reference-blue.css` 走 `<link precedence="opc-reference">`，
//     实测顺序是 layout.css → reference-blue.css → page.css。
//     把设计层放进客户端组件（page.css）后，设计层排到**最后**，
//     同特异性时直接由加载顺序决胜，设计层稳赢。
//     见 src/components/opc/ReplicaInteractions.tsx。
//
// 所有选择器都限定在 .opc-replica 作用域内，不会影响主站页面。
import SiteChrome from '@/components/layout/SiteChrome';
import { site } from '@/lib/site/config';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} · ${site.slogan}`,
    template: `%s | ${site.shortName}`,
  },
  description: site.description,
  keywords: ['OPC', '一人公司', 'AI 创业', '集智', 'AI 社区', '算力超市', '智能体', '北京丰台'],
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: site.name,
    title: `${site.name} · ${site.slogan}`,
    description: site.description,
    images: [
      {
        url: '/api/og',
        width: 1200,
        height: 630,
        alt: `${site.name} · ${site.slogan}`,
      },
    ],
  },
  twitter: { card: 'summary_large_image', images: ['/api/og'] },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#142F59',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 组织与站点实体（PRD FR-SITE-03）。地址只用已确认的信息，不臆造电话/邮箱。
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    legalName: site.company,
    alternateName: site.shortName,
    url: site.url,
    description: site.description,
    slogan: site.slogan,
    address: {
      '@type': 'PostalAddress',
      addressLocality: '北京市',
      addressRegion: '丰台区',
      streetAddress: '大红门',
    },
  };
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    alternateName: site.shortName,
    url: site.url,
    description: site.description,
    inLanguage: 'zh-CN',
    publisher: { '@type': 'Organization', name: site.company, url: site.url },
    // 站内搜索入口（FR-SITE-08 /search?q=）暴露给搜索引擎与 AI 助手
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${site.url}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang="zh-CN">
      <head>
        {/* 面向 LLM 的站点摘要（llmstxt.org）：告诉 AI 助手「这个站是什么、有哪些入口」 */}
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM 站点摘要" />
      </head>
      <body className="min-h-screen bg-white antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--color-brand-navy)] focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          跳转到主要内容
        </a>
        <SiteChrome legacyEntities={[organizationJsonLd, websiteJsonLd]}>{children}</SiteChrome>
      </body>
    </html>
  );
}
