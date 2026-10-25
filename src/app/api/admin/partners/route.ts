import { partnerInputSchema } from '@/lib/admin/resources';
import { partnerToRow } from '@/lib/admin/resource-configs';
import { createResourceCollectionApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createResourceCollectionApi({
  table: 'partners',
  schema: partnerInputSchema,
  toRow: partnerToRow,
  revalidate: ['/'],
});
