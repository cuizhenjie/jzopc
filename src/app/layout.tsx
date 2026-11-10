import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
// 管理后台富文本编辑器/前台富文本正文的排版基线（.rte-scope / .rte-body 作用域内）
import '@/styles/admin-rich-text.css';
// ⚠️ 公开站的视觉基线是**参考站样式表**（/opc/reference/main.css），
// 由 scripts/build-opc-reference.mjs 从参考站快照编译并加上 `.opc-site` 作用域前缀，
// 因此在根布局用 <link> 全局引入也不会影响后台（后台不在 .opc-site 内）。
//
// 旧版「opc-*.css 设计层」已随全站复刻下线（2026-11-10）：
// 它是为 opcstore.com 的旧 DOM 写的，与参考站 DOM 冲突（.hero/.cta/.btn/.form 等同名类）。
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
  };

  return (
    <html lang="zh-CN">
      <head>
        {/* 面向 LLM 的站点摘要（llmstxt.org）：告诉 AI 助手「这个站是什么、有哪些入口」 */}
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM 站点摘要" />
        {/* 参考站视觉基线（已加 .opc-site 作用域前缀）+ 扩展样式（补齐参考站缺失的类） */}
        <link rel="stylesheet" href="/opc/reference/main.css" precedence="opc-reference" />
        <link rel="stylesheet" href="/opc/reference/extension.css" precedence="opc-reference-extension" />
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
