import { mediaInputSchema } from '@/lib/admin/resources';
import { mediaToRow } from '@/lib/admin/resource-configs';
import { createResourceCollectionApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createResourceCollectionApi({
  table: 'media_assets',
  schema: mediaInputSchema,
  toRow: mediaToRow,
  uniqueHint: { field: 'path', message: '该路径已登记' },
});
