import { courseInputSchema } from '@/lib/admin/resources';
import { courseToRow } from '@/lib/admin/resource-configs';
import { createResourceCollectionApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createResourceCollectionApi({
  table: 'courses',
  schema: courseInputSchema,
  toRow: courseToRow,
  revalidate: ['/academy', { path: '/academy/courses/[slug]', type: 'page' }],
});
