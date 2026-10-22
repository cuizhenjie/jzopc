import type { MetadataRoute } from 'next';
import { site } from '@/lib/site/config';
import { replicaPaths } from '@/lib/opc/routes';
import listings from '@/lib/opc/generated/listings.json' with { type: 'json' };

export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url.replace(/\/$/, '');
  const account = new Set(['/opclogin', '/opcregister', '/opcforgotpassword', '/myinfo', '/opcapply', '/newsdetail']);
  return [
    ...replicaPaths.filter(path => !account.has(path)).map(path => ({
      url: `${base}${path}`,
      changeFrequency: 'weekly' as const,
      priority: path === '/' ? 1 : 0.8,
    })),
    ...Object.keys(listings.records).map(id => ({
      url: `${base}/newsdetail?id=${id}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
