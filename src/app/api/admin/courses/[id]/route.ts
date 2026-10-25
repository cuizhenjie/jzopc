import { courseInputSchema } from '@/lib/admin/resources';
import { courseToRow } from '@/lib/admin/resource-configs';
import { createResourceItemApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, PATCH, DELETE } = createResourceItemApi({
  table: 'courses',
  pk: 'id',
  schema: courseInputSchema,
  toRow: courseToRow,
  revalidate: ['/academy', { path: '/academy/courses/[slug]', type: 'page' }],
});
