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
  // 课程方向卡已运行时化（2026-10-26 方式一）：/center 展示 courses 表（DB 优先）
  revalidate: ['/center'],
});
