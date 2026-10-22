import { NextRequest, NextResponse } from 'next/server';
import { getReplicaArticle } from '@/lib/opc/content';

/** Read-only access to the bundled, sanitized public article index. */
export function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') ?? '';
  if (!/^[1-9]\d{0,8}$/.test(id)) return NextResponse.json({ error: '内容不存在' }, { status: 404 });
  const article = getReplicaArticle(id);
  if (!article) return NextResponse.json({ error: '内容不存在' }, { status: 404 });
  return NextResponse.json(article, { headers: { 'Cache-Control': 'public, max-age=3600', 'X-Content-Type-Options': 'nosniff' } });
}
