import { cache } from 'react';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import {
  seedAgents,
  seedCourses,
  seedMarket,
  seedNews,
  type Agent,
  type Course,
  type MarketItem,
  type NewsPost,
} from '@/lib/data/seed';
import { agentCategories, empowerModules, partners, stats } from '@/lib/site/config';

/**
 * 数据访问层：**优先 Supabase，未配置时回落到本地种子数据**。
 * 上层组件不需要知道数据来自哪里。
 *
 * ⚠️ 回落只发生在两种情况下：
 *   1. **未配置 Supabase**（getSupabaseAdmin() 返回 null）—— 本地开发 / 演示环境无库；
 *   2. **查询出错**（网络抖动、表缺失等）—— 库不可用时用种子兜底，保证页面不 500。
 *
 * 「已配置但查不到数据」**不再回落**。这是本轮修掉的真缺陷：
 *   - 库里某条资讯被下架（status != 'published'）时，查询返回空 → 回落种子里的
 *     同名条目 → 页面照常 200，违反 FR-NEWS-05「下架后详情页 404」；
 *   - 库已连接但该表确实没有数据时回落种子 → FR-AGENT-05 要求的
 *     「真·空态引导」永远不会出现。
 *
 * 查不到就是查不到：列表返回 `[]`（页面走 EmptyState 分支），
 * 单条返回 `null`（页面走 notFound() → 404）。
 */

const FALLBACK = { agents: seedAgents, market: seedMarket, courses: seedCourses, news: seedNews };

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

/* ── 站点指标 / 合作企业（内容型数据，不涉及「下架即不可见」语义）────────── */

export const getStats = cache(async () => {
  const sb = getSupabaseAdmin();
  if (!sb) return stats;
  try {
    const { data } = await sb.from('site_stats').select('*').order('sort_order');
    if (!data || data.length === 0) return stats;
    return data.map((r) => ({
      key: r.key as string,
      value: r.value as number,
      suffix: (r.suffix ?? '+') as string,
      label: r.label as string,
    }));
  } catch {
    return stats;
  }
});

export const getPartners = cache(async (): Promise<string[]> => {
  const sb = getSupabaseAdmin();
  if (!sb) return [...partners];
  try {
    const { data } = await sb.from('partners').select('name').eq('published', true).order('sort_order');
    if (!data || data.length === 0) return [...partners];
    return data.map((r) => r.name as string);
  } catch {
    return [...partners];
  }
});

export const getEmpowerModules = cache(async () => [...empowerModules]);
export const getAgentCategories = cache(async () => [...agentCategories]);

/* ── 智能体 ──────────────────────────────────────────────────────────────── */

export const getAgents = cache(async (category?: string): Promise<Agent[]> => {
  const sb = getSupabaseAdmin();
  const pick = (list: Agent[]) => (category ? list.filter((a) => a.category === category) : list);
  // 未配置 Supabase → 种子数据（本地开发 / 演示环境照常有内容）
  if (!sb) return pick(FALLBACK.agents);
  try {
    const { data, error } = await sb
      .from('agents')
      .select('*')
      .eq('published', true)
      .order('sort_order', { ascending: true });
    if (error) {
      console.error(`[queries:agents] 查询失败，回落种子数据：${error.message}`);
      return pick(FALLBACK.agents);
    }
    // 已配置且查询成功 → 真实结果。**空就是空，不回落**（下架即不可见）
    return pick((data ?? []) as Agent[]);
  } catch (e) {
    console.error('[queries:agents] 查询异常，回落种子数据', e);
    return pick(FALLBACK.agents);
  }
});

export const getAgent = cache(async (slug: string): Promise<Agent | null> => {
  const sb = getSupabaseAdmin();
  const seed = FALLBACK.agents.find((a) => a.slug === slug) ?? null;
  if (!sb) return seed;
  try {
    const { data, error } = await sb
      .from('agents')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();
    if (error) {
      console.error(`[queries:agents] 查询失败，回落种子数据：${error.message}`);
      return seed;
    }
    // 库内查不到（未收录 / 已下架）→ null → 页面 notFound() → 404
    return data ? (data as Agent) : null;
  } catch (e) {
    console.error('[queries:agents] 查询异常，回落种子数据', e);
    return seed;
  }
});

/* ── 供需市场 ────────────────────────────────────────────────────────────── */

export const getMarketItems = cache(async (type?: 'demand' | 'supply'): Promise<MarketItem[]> => {
  const sb = getSupabaseAdmin();
  let list: MarketItem[] = FALLBACK.market;
  if (sb) {
    try {
      const { data, error } = await sb
        .from('market_items')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false });
      if (error) {
        console.error(`[queries:market_items] 查询失败，回落种子数据：${error.message}`);
      } else {
        // 已配置且查询成功 → 真实结果。**空就是空，不回落**（下架即不可见）
        list = (data ?? []).map(withBody);
      }
    } catch (e) {
      console.error('[queries:market_items] 查询异常，回落种子数据', e);
    }
  }
  return type ? list.filter((m) => m.type === type) : list;
});

export const getMarketItem = cache(async (slug: string): Promise<MarketItem | null> => {
  const sb = getSupabaseAdmin();
  const seed = FALLBACK.market.find((m) => m.slug === slug) ?? null;
  if (!sb) return seed;
  try {
    const { data, error } = await sb
      .from('market_items')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();
    if (error) {
      console.error(`[queries:market_items] 查询失败，回落种子数据：${error.message}`);
      return seed;
    }
    // 库内查不到（未收录 / 已下架）→ null → 页面 notFound() → 404
    return data ? withBody(data as MarketItem) : null;
  } catch (e) {
    console.error('[queries:market_items] 查询异常，回落种子数据', e);
    return seed;
  }
});

/* ── 课程 ────────────────────────────────────────────────────────────────── */

export const getCourses = cache(async (): Promise<Course[]> => {
  const sb = getSupabaseAdmin();
  if (!sb) return FALLBACK.courses;
  try {
    const { data, error } = await sb
      .from('courses')
      .select('*')
      .eq('published', true)
      .order('sort_order');
    if (error) {
      console.error(`[queries:courses] 查询失败，回落种子数据：${error.message}`);
      return FALLBACK.courses;
    }
    // 已配置且查询成功 → 真实结果。**空就是空，不回落**
    return (data ?? []) as Course[];
  } catch (e) {
    console.error('[queries:courses] 查询异常，回落种子数据', e);
    return FALLBACK.courses;
  }
});

export const getCourse = cache(async (slug: string): Promise<Course | null> => {
  const sb = getSupabaseAdmin();
  const seed = FALLBACK.courses.find((c) => c.slug === slug) ?? null;
  if (!sb) return seed;
  try {
    const { data, error } = await sb
      .from('courses')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .maybeSingle();
    if (error) {
      console.error(`[queries:courses] 查询失败，回落种子数据：${error.message}`);
      return seed;
    }
    // 库内查不到（未收录 / 已下架）→ null → 页面 notFound() → 404
    return data ? withBody(data as Course) : null;
  } catch (e) {
    console.error('[queries:courses] 查询异常，回落种子数据', e);
    return seed;
  }
});

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
    // 库内查不到（未收录 / 已下架）→ null → 页面 notFound() → 404
    return data ? withBody(data as NewsPost) : null;
  } catch (e) {
    console.error('[queries:news_posts] 查询异常，回落种子数据', e);
    return seed;
  }
});
