import { partnerInputSchema } from '@/lib/admin/resources';
import { partnerToRow } from '@/lib/admin/resource-configs';
import { createResourceItemApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, PATCH, DELETE } = createResourceItemApi({
  table: 'partners',
  pk: 'id',
  schema: partnerInputSchema,
  toRow: partnerToRow,
  revalidate: ['/'],
});
