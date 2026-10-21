import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import JsonLd from '@/components/ui/JsonLd';
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
        <JsonLd data={organizationJsonLd} />
        <JsonLd data={websiteJsonLd} />
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
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
