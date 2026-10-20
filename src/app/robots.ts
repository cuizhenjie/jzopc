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
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
