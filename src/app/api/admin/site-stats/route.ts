import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rejectIfUnauthedApi } from '@/lib/admin/auth';
import { siteStatInputSchema } from '@/lib/admin/resources';
import { zodFieldErrors } from '@/lib/admin/news-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 统计数字管理（site_stats 表，key 为主键、无 published）。
 *   POST   创建一项
 *   PATCH  {key, ...fields} 按行内编辑更新（key 不可改）
 *   DELETE ?key=xxx 删除一项
 * 数值在首页数字墙直接展示，保存后 revalidate 首页。
 */

function revalidateHome() {
  revalidatePath('/');
}

export async function POST(req: Request) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: '请求格式错误' }, { status: 400 });
  }
  const parsed = siteStatInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: '请检查填写是否完整。', errors: zodFieldErrors(parsed.error.issues) },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, message: '未连接数据库，无法保存' }, { status: 503 });

  const { error } = await sb.from('site_stats').insert(parsed.data);
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { ok: false, message: '保存冲突。', errors: { key: '该 key 已存在' } },
        { status: 409 },
      );
    }
    console.error('[admin:site_stats-create-failed]', error);
    return NextResponse.json({ ok: false, message: '保存失败，请稍后重试。' }, { status: 500 });
  }

  revalidateHome();
  return NextResponse.json({ ok: true, id: parsed.data.key });
}

export async function PATCH(req: Request) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  let body: { key?: unknown } & Record<string, unknown>;
  try {
    body = (await req.json()) as { key?: unknown } & Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: '请求格式错误' }, { status: 400 });
  }
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  if (!key || key.length > 40) {
    return NextResponse.json({ ok: false, message: '参数不合法' }, { status: 400 });
  }

  // 行内编辑只允许改这四列；key 是主键不可改
  const patch: Record<string, unknown> = {};
  if (body.value !== undefined) {
    const n = Number(body.value);
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000_000) {
      return NextResponse.json({ ok: false, message: '数值需为 0 ~ 10 亿的整数' }, { status: 400 });
    }
    patch.value = n;
  }
  if (body.suffix !== undefined) {
    if (typeof body.suffix !== 'string' || body.suffix.trim().length > 8) {
      return NextResponse.json({ ok: false, message: '后缀过长（≤8 字）' }, { status: 400 });
    }
    patch.suffix = body.suffix.trim();
  }
  if (body.label !== undefined) {
    if (typeof body.label !== 'string' || !body.label.trim() || body.label.trim().length > 40) {
      return NextResponse.json({ ok: false, message: '标签需为 1-40 字' }, { status: 400 });
    }
    patch.label = body.label.trim();
  }
  if (body.sort_order !== undefined) {
    const n = Number(body.sort_order);
    if (!Number.isInteger(n) || n < 0 || n > 9999) {
      return NextResponse.json({ ok: false, message: '排序需为 0-9999 的整数' }, { status: 400 });
    }
    patch.sort_order = n;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, message: '没有要更新的字段' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, message: '未连接数据库，无法保存' }, { status: 503 });

  const { data, error } = await sb.from('site_stats').update(patch).eq('key', key).select('key').limit(1);
  if (error) {
    console.error('[admin:site_stats-update-failed]', error);
    return NextResponse.json({ ok: false, message: '更新失败' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ ok: false, message: '记录不存在' }, { status: 404 });
  }

  revalidateHome();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  const key = new URL(req.url).searchParams.get('key')?.trim() ?? '';
  if (!key || key.length > 40) {
    return NextResponse.json({ ok: false, message: '参数不合法' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, message: '未连接数据库' }, { status: 503 });

  const { data, error } = await sb.from('site_stats').delete().eq('key', key).select('key').limit(1);
  if (error) {
    console.error('[admin:site_stats-delete-failed]', error);
    return NextResponse.json({ ok: false, message: '删除失败' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ ok: false, message: '记录不存在' }, { status: 404 });
  }

  revalidateHome();
  return NextResponse.json({ ok: true });
}
