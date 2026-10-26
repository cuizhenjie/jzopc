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
  // 智能体目录已运行时化（2026-10-26 方式一）：/agent 展示 agents 表（DB 优先）
  revalidate: ['/agent'],
});
