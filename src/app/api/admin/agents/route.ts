import { agentInputSchema } from '@/lib/admin/resources';
import { agentToRow } from '@/lib/admin/resource-configs';
import { createResourceCollectionApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createResourceCollectionApi({
  table: 'agents',
  schema: agentInputSchema,
  toRow: agentToRow,
  revalidate: ['/agents', { path: '/agents/[slug]', type: 'page' }],
});
