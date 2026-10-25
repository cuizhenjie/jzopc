import { marketItemInputSchema } from '@/lib/admin/resources';
import { marketToRow } from '@/lib/admin/resource-configs';
import { createResourceCollectionApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createResourceCollectionApi({
  table: 'market_items',
  schema: marketItemInputSchema,
  toRow: marketToRow,
  revalidate: ['/market', { path: '/market/[slug]', type: 'page' }],
});
