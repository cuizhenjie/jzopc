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
  // 供需卡已运行时化（2026-10-26 方式一）：/market 展示 market_items 表（DB 优先）
  revalidate: ['/market'],
});
