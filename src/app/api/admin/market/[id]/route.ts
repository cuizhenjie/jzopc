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
  revalidate: ['/market', { path: '/market/[slug]', type: 'page' }],
});
