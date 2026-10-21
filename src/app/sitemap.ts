import type { MetadataRoute } from 'next';
import { site } from '@/lib/site/config';
import { getAgents, getCourses, getMarketItems, getNewsPosts } from '@/lib/queries';
import { empowerDetails } from '@/lib/data/empower';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url.replace(/\/$/, '');

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/about/history`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/about/audience`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/about/partners`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/agents`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/market`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/academy`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/traffic`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/news`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/search`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${base}/apply`, changeFrequency: 'monthly', priority: 0.9 },
    ...empowerDetails.map((m) => ({
      url: `${base}/empower/${m.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];

  const [agents, market, courses, news] = await Promise.all([
    getAgents(),
    getMarketItems(),
    getCourses(),
    getNewsPosts(),
  ]);

  const dynamicRoutes: MetadataRoute.Sitemap = [
    ...agents.map((a) => ({
      url: `${base}/agents/${a.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...market.map((m) => ({
      url: `${base}/market/${m.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...courses.map((c) => ({
      url: `${base}/academy/courses/${c.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...news.map((n) => ({
      url: `${base}/news/${n.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];

  return [...staticRoutes, ...dynamicRoutes];
}
