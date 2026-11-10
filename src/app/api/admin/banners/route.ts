import { homeBannerInputSchema } from '@/lib/admin/resources';
import { homeBannerToRow } from '@/lib/admin/resource-configs';
import { createResourceCollectionApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 首页首屏 Banner 列表。创建成功后失效首页，下一请求按已发布图重绘轮播。 */
export const POST = createResourceCollectionApi({
  table: 'home_banners',
  schema: homeBannerInputSchema,
  toRow: homeBannerToRow,
  revalidate: ['/'],
});
