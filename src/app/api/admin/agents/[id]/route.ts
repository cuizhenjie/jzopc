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
  revalidate: ['/agents', { path: '/agents/[slug]', type: 'page' }],
});
