import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
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
  return (
    <html lang="zh-CN">
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
