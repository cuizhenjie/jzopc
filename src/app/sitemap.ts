import type { MetadataRoute } from 'next';
import { site } from '@/lib/site/config';
import { replicaPaths } from '@/lib/opc/routes';
import { loadPublishedNewsPosts, newsDetailIdOfSlug } from '@/lib/opc/news-runtime';

/** /newsdetail 条目：DB 已发布文章（id 取值与卡片 data-opc-id 同款）。
 *  未配库/查询异常 → 无文章条目（DB 唯一事实源，不回落 listings 快照）。 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url.replace(/\/$/, '');
  const account = new Set(['/opclogin', '/opcregister', '/opcforgotpassword', '/myinfo', '/opcapply', '/newsdetail']);
  let detailIds: string[] = [];
  try {
    const posts = await loadPublishedNewsPosts();
    if (posts) detailIds = posts.map((post) => newsDetailIdOfSlug(post.slug));
  } catch (error) {
    console.error('[sitemap] 读取 news_posts 失败，本批不含文章条目', error);
  }
  return [
    ...replicaPaths.filter(path => !account.has(path)).map(path => ({
      url: `${base}${path}`,
      changeFrequency: 'weekly' as const,
      priority: path === '/' ? 1 : 0.8,
    })),
    ...detailIds.map(id => ({
      url: `${base}/newsdetail?id=${encodeURIComponent(id)}`,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
