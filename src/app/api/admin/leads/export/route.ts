import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rejectIfUnauthedApi } from '@/lib/admin/auth';
import { LEAD_CSV_COLUMNS, LEAD_PAGE_SIZE, leadsToCsv, type AdminLeadRow } from '@/lib/admin/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 线索 CSV 导出。筛选参数与 /admin/leads 页面一致（status/type/q），
 * 导出全部命中行（不受分页限制），带 BOM，Excel 直接打开中文不乱码。
 */
export async function GET(req: Request) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ ok: false, message: '未连接数据库' }, { status: 503 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? '';
  const type = url.searchParams.get('type') ?? '';
  const q = url.searchParams.get('q')?.trim() ?? '';

  let query = sb.from('leads').select(LEAD_CSV_COLUMNS.map((c) => String(c.key)).join(','));
  if (status) query = query.eq('status', status);
  if (type) query = query.eq('lead_type', type);
  if (q) {
    const kw = `%${q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
    query = query.or(`name.ilike.${kw},contact.ilike.${kw},org_name.ilike.${kw}`);
  }

  const rows: AdminLeadRow[] = [];
  // 分批拉取（每批 50 条上限），避免一次 range 过大被 PostgREST 拒绝
  for (let offset = 0; offset < 10_000; offset += LEAD_PAGE_SIZE) {
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + LEAD_PAGE_SIZE - 1);
    if (error) {
      console.error(`[admin:lead-export] 查询失败：${error.message}`);
      return NextResponse.json({ ok: false, message: '导出失败' }, { status: 500 });
    }
    rows.push(...((data ?? []) as unknown as AdminLeadRow[]));
    if (!data || data.length < LEAD_PAGE_SIZE) break;
  }

  const csv = leadsToCsv(rows);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leads-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
