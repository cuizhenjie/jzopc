import { NextRequest, NextResponse } from 'next/server';
import { getReplicaDetailPage } from '@/lib/opc/news-runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 只读访问公开文章内容（与 /newsdetail 同一份 DB 事实源）。
 *
 * 2026-11-10 起不再返回打包快照：文章由后台 news_posts 维护，
 * 未配库 / 库内无此文一律 404（DB 是唯一事实源）。
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!/^[1-9]\d{0,8}$|^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/.test(id)) {
    return NextResponse.json({ error: '内容不存在' }, { status: 404 });
  }
  const page = await getReplicaDetailPage(id);
  if (!page) return NextResponse.json({ error: '内容不存在' }, { status: 404 });
  return NextResponse.json(
    { id, title: page.title, html: page.html },
    { headers: { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' } },
  );
}
