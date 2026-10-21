import { NextResponse } from 'next/server';
import { buildSearchIndex } from '@/lib/search';
import { matchItems } from '@/lib/search/matcher';

export const runtime = 'nodejs';

/**
 * 站内搜索接口（机器可读）。
 *
 * ## 为什么强制动态
 *
 * 命中条件 `q` / `type` 来自查询参数，必须**逐请求求值**；
 * 走 Next 的静态响应缓存会有把「无参数的那一版」复用给带参请求的风险。
 * 因此这里 `force-dynamic`，把缓存放到**数据层**
 * （`buildSearchIndex()` 的 10 分钟 TTL），既不每次打 Supabase，
 * 也不会返回与请求参数不匹配的结果。
 */
export const dynamic = 'force-dynamic';

/**
 * `GET /api/search?q=关键词&type=agent|market|course|news`
 *
 * 返回 `{ query, type, total, items }`；`items` 为 `SearchItem[]`。
 * 无 `q` 时返回全量索引。
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  const type = (searchParams.get('type') ?? '').trim();

  try {
    const index = await buildSearchIndex();
    // 与页面共用 matchItems —— 接口结果与页面结果必须一致
    const items = matchItems(index, { q, type });

    return NextResponse.json(
      { query: q, type: type || 'all', total: items.length, items },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } },
    );
  } catch (error) {
    // 出错就明说，不假装「搜索结果为空」
    console.error('[api/search] 构建搜索索引失败', error);
    return NextResponse.json(
      {
        query: q,
        type: type || 'all',
        total: 0,
        items: [],
        error: error instanceof Error ? error.message : '搜索索引构建失败',
      },
      { status: 500 },
    );
  }
}
