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
 */

const FALLBACK = { agents: seedAgents, market: seedMarket, courses: seedCourses, news: seedNews };

async function fetchTable<T>(table: string, fallback: T[], order?: string): Promise<T[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return fallback;
  try {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .eq('published', true)
      .order(order ?? 'sort_order', { ascending: true });
    if (error || !data || data.length === 0) return fallback;
    return data as T[];
  } catch {
    return fallback;
  }
}

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

export const getAgents = cache(async (category?: string): Promise<Agent[]> => {
  const list = await fetchTable<Agent>('agents', FALLBACK.agents);
  return category ? list.filter((a) => a.category === category) : list;
});

export const getAgent = cache(async (slug: string): Promise<Agent | null> => {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data } = await sb
        .from('agents')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
      if (data) return data as Agent;
    } catch {
      /* 回落到种子数据 */
    }
  }
  return FALLBACK.agents.find((a) => a.slug === slug) ?? null;
});

export const getMarketItems = cache(async (type?: 'demand' | 'supply'): Promise<MarketItem[]> => {
  const sb = getSupabaseAdmin();
  let list = FALLBACK.market;
  if (sb) {
    try {
      const { data } = await sb
        .from('market_items')
        .select('*')
        .eq('published', true)
        .order('published_at', { ascending: false });
      if (data && data.length > 0) list = data as MarketItem[];
    } catch {
      /* 回落到种子数据 */
    }
  }
  return type ? list.filter((m) => m.type === type) : list;
});

export const getMarketItem = cache(async (slug: string): Promise<MarketItem | null> => {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data } = await sb
        .from('market_items')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
      if (data) return data as MarketItem;
    } catch {
      /* 回落到种子数据 */
    }
  }
  return FALLBACK.market.find((m) => m.slug === slug) ?? null;
});

export const getCourses = cache(async (): Promise<Course[]> => {
  const sb = getSupabaseAdmin();
  if (!sb) return FALLBACK.courses;
  try {
    const { data } = await sb.from('courses').select('*').eq('published', true).order('sort_order');
    if (!data || data.length === 0) return FALLBACK.courses;
    return data as Course[];
  } catch {
    return FALLBACK.courses;
  }
});

export const getCourse = cache(async (slug: string): Promise<Course | null> => {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data } = await sb
        .from('courses')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();
      if (data) return data as Course;
    } catch {
      /* 回落到种子数据 */
    }
  }
  return FALLBACK.courses.find((c) => c.slug === slug) ?? null;
});

export const getNewsPosts = cache(async (category?: string): Promise<NewsPost[]> => {
  const sb = getSupabaseAdmin();
  let list = FALLBACK.news;
  if (sb) {
    try {
      const { data } = await sb
        .from('news_posts')
        .select('*')
        .eq('status', 'published')
        .order('published_at', { ascending: false });
      if (data && data.length > 0) list = data as NewsPost[];
    } catch {
      /* 回落到种子数据 */
    }
  }
  return category ? list.filter((n) => n.category === category) : list;
});

export const getNewsPost = cache(async (slug: string): Promise<NewsPost | null> => {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data } = await sb
        .from('news_posts')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();
      if (data) return data as NewsPost;
    } catch {
      /* 回落到种子数据 */
    }
  }
  return FALLBACK.news.find((n) => n.slug === slug) ?? null;
});
