import { empowerInputSchema } from '@/lib/admin/resources';
import { empowerToRow } from '@/lib/admin/resource-configs';
import { createResourceItemApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, PATCH, DELETE } = createResourceItemApi({
  table: 'empower_modules',
  pk: 'slug',
  schema: empowerInputSchema,
  toRow: empowerToRow,
  revalidate: ['/', { path: '/empower/[slug]', type: 'page' }],
});
