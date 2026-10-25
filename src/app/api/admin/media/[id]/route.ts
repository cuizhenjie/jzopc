import { mediaInputSchema } from '@/lib/admin/resources';
import { mediaToRow } from '@/lib/admin/resource-configs';
import { createResourceItemApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, PATCH, DELETE } = createResourceItemApi({
  table: 'media_assets',
  pk: 'id',
  schema: mediaInputSchema,
  toRow: mediaToRow,
});
