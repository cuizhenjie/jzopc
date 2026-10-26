import { agentInputSchema } from '@/lib/admin/resources';
import { agentToRow } from '@/lib/admin/resource-configs';
import { createResourceItemApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, PATCH, DELETE } = createResourceItemApi({
  table: 'agents',
  pk: 'id',
  schema: agentInputSchema,
  toRow: agentToRow,
  // 公开页 /agents 已下线（308 → /agent 复刻快照，不查本表），无前台缓存可失效
});
