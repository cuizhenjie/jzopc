import { empowerInputSchema } from '@/lib/admin/resources';
import { empowerToRow } from '@/lib/admin/resource-configs';
import { createResourceCollectionApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createResourceCollectionApi({
  table: 'empower_modules',
  schema: empowerInputSchema,
  toRow: empowerToRow,
  revalidate: ['/', { path: '/empower/[slug]', type: 'page' }],
});
