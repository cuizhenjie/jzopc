import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rejectIfUnauthedApi } from '@/lib/admin/auth';
import { LEAD_STATUSES, leadStatusLabels } from '@/lib/admin/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedStatus = new Set<string>(LEAD_STATUSES);

/** 更新线索（状态 / 备注）。note 与 status 至少传一个。 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  const { id } = await ctx.params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return NextResponse.json({ ok: false, message: '参数不合法' }, { status: 400 });
  }

  let body: { status?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: '请求格式错误' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !allowedStatus.has(body.status)) {
      return NextResponse.json(
        { ok: false, message: `状态不合法，可选：${Object.values(leadStatusLabels).join('/')}` },
        { status: 400 },
      );
    }
    patch.status = body.status;
  }

  if (body.note !== undefined) {
    if (typeof body.note !== 'string' || body.note.length > 2000) {
      return NextResponse.json({ ok: false, message: '备注需为不超过 2000 字的文本' }, { status: 400 });
    }
    patch.note = body.note.trim() || null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, message: '没有要更新的字段' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ ok: false, message: '未连接数据库' }, { status: 503 });
  }

  const { error } = await sb.from('leads').update(patch).eq('id', leadId);
  if (error) {
    console.error('[admin:lead-update-failed]', error);
    return NextResponse.json({ ok: false, message: '更新失败' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** 删除线索（误提交 / 垃圾数据清理，前端有二次确认）。 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  const { id } = await ctx.params;
  const leadId = Number(id);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    return NextResponse.json({ ok: false, message: '参数不合法' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ ok: false, message: '未连接数据库' }, { status: 503 });
  }

  const { error } = await sb.from('leads').delete().eq('id', leadId);
  if (error) {
    console.error('[admin:lead-delete-failed]', error);
    return NextResponse.json({ ok: false, message: '删除失败' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
