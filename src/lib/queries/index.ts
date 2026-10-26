import { cache } from 'react';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { seedNews, type NewsPost } from '@/lib/data/seed';

/**
 * 数据访问层：**优先 Supabase，未配置时回落到本地种子数据**。
 * 上层组件不需要知道数据来自哪里。
 *
 * ⚠️ 回落只发生在两种情况下：
 *   1. **未配置 Supabase**（getSupabaseAdmin() 返回 null）—— 本地开发 / 演示环境无库；
 *   2. **查询出错**（网络抖动、表缺失等）—— 库不可用时用种子兜底，保证页面不 500。
 *
 * 「已配置但查不到数据」**不回落**：
 * 库里某条资讯被下架（status != 'published'）时，查询返回空——查不到就是查不到，
 * 列表返回 `[]`、单条返回 `null`（详情走 404），不会拿种子内容顶上。
 *
 * 2026-10-26 第二批清理后本模块只服务**新闻/动态线**（news-runtime →
 * /newslist /activitylist /newsdetail）。智能体 / 课程 / 供需的公开查询函数
 * 已随旧版原生页一并下线（页面 308 收敛到复刻页，复刻页不查这三张表；
 * 后台对这三张表的 CRUD 走 lib/admin/resource-*.ts，不经这里）。
 */

const FALLBACK = { news: seedNews };

/**
 * 归一化 DB 行的正文字段。
 *
 * `body` 在 DB 里是 jsonb 段落数组；旧迁移曾定义成 `body_md text`，
 * 接真库时 `post.body` 会是 undefined —— 页面直接 `post.body.map(...)` 会抛错。
 * 这里统一兜底成数组：即使数据形状不对，页面也只是少一段正文，不会 500。
 *
 * 只作用于 **DB 返回的行**：种子数据本身不带 body 字段，改写它会改变种子对象的形状。
 */
function withBody<T extends { body?: unknown }>(row: T): T & { body: string[] } {
  const body = Array.isArray(row?.body)
    ? row.body.filter((x): x is string => typeof x === 'string')
    : [];
  return { ...row, body };
}

/* ── 社区动态 ────────────────────────────────────────────────────────────── */

export const getNewsPosts = cache(async (category?: string): Promise<NewsPost[]> => {
  const sb = getSupabaseAdmin();
  let list: NewsPost[] = FALLBACK.news;
  if (sb) {
    try {
      const { data, error } = await sb
        .from('news_posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (error) {
        console.error(`[queries:news_posts] 查询失败，回落种子数据：${error.message}`);
      } else {
        // 已配置且查询成功 → 真实结果。**空就是空，不回落**（下架即不可见）
        list = (data ?? []).map(withBody);
      }
    } catch (e) {
      console.error('[queries:news_posts] 查询异常，回落种子数据', e);
    }
  }
  return category ? list.filter((n) => n.category === category) : list;
});

export const getNewsPost = cache(async (slug: string): Promise<NewsPost | null> => {
  const sb = getSupabaseAdmin();
  const seed = FALLBACK.news.find((n) => n.slug === slug) ?? null;
  if (!sb) return seed;
  try {
    const { data, error } = await sb
      .from('news_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    if (error) {
      console.error(`[queries:news_posts] 查询失败，回落种子数据：${error.message}`);
      return seed;
    }
    // 库内查不到（未收录 / 已下架）→ null → 详情 404
    return data ? withBody(data as NewsPost) : null;
  } catch (e) {
    console.error('[queries:news_posts] 查询异常，回落种子数据', e);
    return seed;
  }
});
