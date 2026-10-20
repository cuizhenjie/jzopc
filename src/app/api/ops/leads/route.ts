import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { opsCookieName, tokenMatches } from '@/lib/ops/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowed = new Set(['new', 'contacting', 'converted', 'invalid']);

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(opsCookieName)?.value;
  const headerToken = req.headers.get('x-ops-token');

  if (!tokenMatches(cookieToken) && !tokenMatches(headerToken)) {
    return NextResponse.json({ ok: false, message: '未授权' }, { status: 401 });
  }

  let body: { id?: number; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: '请求格式错误' }, { status: 400 });
  }

  if (!body.id || !body.status || !allowed.has(body.status)) {
    return NextResponse.json({ ok: false, message: '参数不合法' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ ok: false, message: '未连接数据库' }, { status: 503 });
  }

  const { error } = await sb
    .from('leads')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', body.id);

  if (error) {
    console.error('[ops:update-failed]', error);
    return NextResponse.json({ ok: false, message: '更新失败' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
