import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rejectIfUnauthedApi } from '@/lib/admin/auth';
import { newsInputSchema, toNewsRow, zodFieldErrors } from '@/lib/admin/news-schema';
import { revalidateNewsPages } from '@/lib/admin/news-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: '请求格式错误' }, { status: 400 });
  }

  const parsed = newsInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: '请检查表单填写是否完整。', errors: zodFieldErrors(parsed.error.issues) },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({ ok: false, message: '未连接数据库，无法保存' }, { status: 503 });
  }

  const row = toNewsRow(parsed.data);
  const { data, error } = await sb.from('news_posts').insert(row).select('id, slug').single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { ok: false, message: 'slug 已被占用，请换一个。', errors: { slug: '该 slug 已存在' } },
        { status: 409 },
      );
    }
    console.error('[admin:news-create-failed]', error);
    return NextResponse.json({ ok: false, message: '保存失败，请稍后重试。' }, { status: 500 });
  }

  if (parsed.data.status === 'published') {
    revalidateNewsPages(parsed.data.slug);
  }
  return NextResponse.json({ ok: true, id: (data as { id: number }).id });
}
