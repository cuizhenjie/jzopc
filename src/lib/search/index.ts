import { getAgents, getCourses, getMarketItems, getNewsPosts } from '@/lib/queries';
import {
  agentToSearchItem,
  courseToSearchItem,
  marketToSearchItem,
  newsToSearchItem,
} from '@/lib/search/items';
import type { SearchItem } from '@/lib/search/matcher';

export type { SearchItem, SearchItemType } from '@/lib/search/matcher';

/**
 * 服务端搜索索引 —— 把四类内容拍平成一条 `SearchItem[]`。
 *
 * ## 数据来源
 *
 * 全部来自 `@/lib/queries`（Supabase 优先，未配置时回落本地种子数据），
 * **不新增任何取数逻辑**，也不臆造条目：标题、摘要、分类、标签都是真实字段。
 *
 * ## 缓存
 *
 * React 的 `cache()` 只在单次请求内去重，**跨请求无效** —— 每次请求都打
 * Supabase 的话，这个接口根本扛不住。所以这里用模块级 TTL 缓存
 * （10 分钟，与页面 `revalidate = 600` 对齐）把索引本身缓存住。
 */
/**
 * 智能体分类是 slug（如 office），展示要用中文名（如 办公）——
 * 转换逻辑统一在 `src/lib/search/items.ts`，列表页与全局索引共用同一份。
 */
async function queryIndex(): Promise<SearchItem[]> {
  const [agents, market, courses, news] = await Promise.all([
    getAgents(),
    getMarketItems(),
    getCourses(),
    getNewsPosts(),
  ]);

  return [
    ...agents.map(agentToSearchItem),
    ...market.map(marketToSearchItem),
    ...courses.map(courseToSearchItem),
    ...news.map(newsToSearchItem),
  ];
}

/** 索引缓存窗口：10 分钟 */
const TTL_MS = 10 * 60 * 1000;

let cached: { at: number; items: SearchItem[] } | null = null;
let pending: Promise<SearchItem[]> | null = null;

/**
 * 取全量搜索索引（带 10 分钟 TTL 缓存）。
 *
 * 并发请求共享同一次取数（`pending` 去重），不会把 Supabase 打穿。
 */
export async function buildSearchIndex(): Promise<SearchItem[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.items;
  if (pending) return pending;

  pending = queryIndex()
    .then((items) => {
      cached = { at: Date.now(), items };
      return items;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}
