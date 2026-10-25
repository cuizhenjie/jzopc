import { siteContentInputSchema } from '@/lib/admin/resources';
import { siteContentToRow } from '@/lib/admin/resource-configs';
import { createResourceCollectionApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createResourceCollectionApi({
  table: 'site_contents',
  schema: siteContentInputSchema,
  toRow: siteContentToRow,
  uniqueHint: { field: 'slug', message: '同区块下该内容标识已存在' },
  conflictMessage: '保存冲突：同区块下已有同标识的内容。',
  revalidate: ['/'],
});
