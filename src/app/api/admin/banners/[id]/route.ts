import { homeBannerInputSchema } from '@/lib/admin/resources';
import { homeBannerToRow } from '@/lib/admin/resource-configs';
import { createResourceItemApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, PATCH, DELETE } = createResourceItemApi({
  table: 'home_banners',
  pk: 'id',
  schema: homeBannerInputSchema,
  toRow: homeBannerToRow,
  revalidate: ['/'],
});
