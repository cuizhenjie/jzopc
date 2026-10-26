import { marketItemInputSchema } from '@/lib/admin/resources';
import { marketToRow } from '@/lib/admin/resource-configs';
import { createResourceItemApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, PATCH, DELETE } = createResourceItemApi({
  table: 'market_items',
  pk: 'id',
  schema: marketItemInputSchema,
  toRow: marketToRow,
  // /market 复刻快照不查本表、详情页已 308，无前台缓存可失效
});
