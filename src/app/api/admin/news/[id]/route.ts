import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rejectIfUnauthedApi } from '@/lib/admin/auth';
import { newsInputSchema, toNewsRow, zodFieldErrors } from '@/lib/admin/news-schema';
import { revalidateNewsPages } from '@/lib/admin/news-server';
import { NEWS_STATUSES } from '@/lib/admin/news-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 更新新闻：全量提交表单字段（与新建同一 schema），或仅切换状态（快速上下架）。 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  const { id } = await ctx.params;
  const newsId = Number(id);
  if (!Number.isInteger(newsId) || newsId <= 0) {
    return NextResponse.json({ ok: false, message: '参数不合法' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: '请求格式错误' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ ok: false, message: '未连接数据库，无法保存' }, { status: 503 });
  }

  // 快捷路径：只传 { status } → 仅切状态（列表页「发布/下架」按钮）
  const keys = Object.keys(body);
  if (keys.length === 1 && keys[0] === 'status') {
    if (typeof body.status !== 'string' || !(NEWS_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ ok: false, message: '状态不合法' }, { status: 400 });
    }
    const { data, error } = await sb
      .from('news_posts')
      .update({ status: body.status })
      .eq('id', newsId)
      .select('slug')
      .single();
    if (error) {
      console.error('[admin:news-status-failed]', error);
      return NextResponse.json({ ok: false, message: '更新失败' }, { status: 500 });
    }
    // 无论改成什么状态都失效：下架后详情页必须立即 404（FR-NEWS-05）
    revalidateNewsPages((data as { slug?: string })?.slug);
    return NextResponse.json({ ok: true });
  }

  const parsed = newsInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: '请检查表单填写是否完整。', errors: zodFieldErrors(parsed.error.issues) },
      { status: 400 },
    );
  }

  const row = toNewsRow(parsed.data);
  const { data, error } = await sb
    .from('news_posts')
    .update(row)
    .eq('id', newsId)
    .select('slug')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { ok: false, message: 'slug 已被占用，请换一个。', errors: { slug: '该 slug 已存在' } },
        { status: 409 },
      );
    }
    console.error('[admin:news-update-failed]', error);
    return NextResponse.json({ ok: false, message: '保存失败，请稍后重试。' }, { status: 500 });
  }

  revalidateNewsPages(parsed.data.slug);
  return NextResponse.json({ ok: true });
}

/** 删除新闻（不可恢复；前端有二次确认。日常下架请用「下架」而不是删除）。 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  const { id } = await ctx.params;
  const newsId = Number(id);
  if (!Number.isInteger(newsId) || newsId <= 0) {
    return NextResponse.json({ ok: false, message: '参数不合法' }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ ok: false, message: '未连接数据库' }, { status: 503 });
  }

  const { data, error } = await sb.from('news_posts').delete().eq('id', newsId).select('slug').single();
  if (error) {
    console.error('[admin:news-delete-failed]', error);
    return NextResponse.json({ ok: false, message: '删除失败' }, { status: 500 });
  }
  revalidateNewsPages((data as { slug?: string })?.slug);
  return NextResponse.json({ ok: true });
}
