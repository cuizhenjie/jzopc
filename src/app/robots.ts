import type { MetadataRoute } from 'next';
import { site } from '@/lib/site/config';

export default function robots(): MetadataRoute.Robots {
  const base = site.url.replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/ops', '/api', '/_next'],
      },
      {
        // LLM 站点摘要：明确放行，便于 AI 助手 / 检索工具抓取
        userAgent: '*',
        allow: ['/llms.txt', '/llm.txt'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
