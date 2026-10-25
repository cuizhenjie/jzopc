import { siteContentInputSchema } from '@/lib/admin/resources';
import { siteContentToRow } from '@/lib/admin/resource-configs';
import { createResourceItemApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, PATCH, DELETE } = createResourceItemApi({
  table: 'site_contents',
  pk: 'id',
  schema: siteContentInputSchema,
  toRow: siteContentToRow,
  revalidate: ['/'],
});
