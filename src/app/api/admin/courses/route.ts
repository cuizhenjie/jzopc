import { courseInputSchema } from '@/lib/admin/resources';
import { courseToRow } from '@/lib/admin/resource-configs';
import { createResourceCollectionApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createResourceCollectionApi({
  table: 'courses',
  schema: courseInputSchema,
  toRow: courseToRow,
  // 公开页 /academy 已下线（308 → /center 复刻快照，不查本表），无前台缓存可失效
});
