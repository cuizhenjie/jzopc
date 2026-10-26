import { partnerInputSchema } from '@/lib/admin/resources';
import { partnerToRow } from '@/lib/admin/resource-configs';
import { createResourceCollectionApi } from '@/lib/admin/resource-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = createResourceCollectionApi({
  table: 'partners',
  schema: partnerInputSchema,
  toRow: partnerToRow,
  // 伙伴墙已运行时化（2026-10-26 方式一）：首页 / 供需 / 工作三页展示 partners 表
  revalidate: ['/', '/market', '/work'],
});
