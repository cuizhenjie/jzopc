/**
 * 全局搜索的**纯函数**匹配逻辑。
 *
 * ## 为什么要单独抽一个文件
 *
 * 搜索有两个消费方：
 *
 * - `/search` 页面 —— 服务端渲染全部条目，客户端由 `FilterRoot` 按
 *   `data-filter-key` / `data-filter-text` 做同样的匹配；
 * - `/api/search` 接口 —— 服务端直接调用 `matchItems()`。
 *
 * 两者必须给出**同一套结果**，否则「页面上看到的」和「接口拿到的」会对不上。
 * 所以规则只写在这里，页面侧用 `searchItemText()` 生成 `data-filter-text`，
 * 保证连「被匹配的文本」都是同一串（不只是同一套规则）。
 *
 * ## 约束
 *
 * 本文件必须 **isomorphic**：客户端组件也会 import 它，
 * 因此**不许** import 任何 server-only 模块（Supabase / react cache 等）。
 */

export type SearchItemType = 'agent' | 'market' | 'course' | 'news';

export type SearchItem = {
  /** 分类键：与页面 `data-filter-key`、接口 `type` 参数一致 */
  type: SearchItemType;
  /** 展示用类型名（智能体 / 需求 / 供给 / 课程 / 动态） */
  typeLabel: string;
  /**
   * 类型入口词：参与匹配，但**不展示**。
   *
   * 为什么必须有它：PRD FR-SITE-08 写的检索范围是「智能体、供需、课程、资讯」——
   * 这四个词是用户最可能敲进去的。而 29 个智能体条目的标题/摘要/标签里
   * **一个「智能体」都没有**（它们叫飞书、钉钉、讯飞听见…），
   * 不把这四个词放进可检索文本，搜「智能体」会一条都搜不到。
   *
   * 逐条计算而不是按类型固定：需求方条目的入口词是「供需 需求」，
   * 供给方是「供需 供给」——搜「需求」不该把供给方也带出来。
   */
  typeSearch?: string;
  title: string;
  summary: string;
  /** 站内绝对路径，如 /agents/feishu */
  href: string;
  /** 所属分类（智能体为分类中文名，供需为业务分类，课程为方向，动态为资讯分类） */
  category?: string;
  /** 参与匹配的补充文本（标签、发布方、导师等） */
  keywords?: string;
  /** 更长的描述文本（智能体简介、正文段落）：参与匹配但不展示 */
  detail?: string;
};

/** 四类内容的固定顺序：页面筛选条与接口 type 参数都按它来 */
export const SEARCH_ITEM_TYPES: readonly SearchItemType[] = ['agent', 'market', 'course', 'news'] as const;

/**
 * 条目参与匹配的全部文本。
 *
 * 页面把它写进 `data-filter-text`，`FilterRoot` 用同一串做子串匹配；
 * `matchItems` 也用同一串做匹配 —— 两边的可检索文本逐字相同。
 *
 * 组成：标题 + 摘要 + 分类 + 标签 + **类型入口词** + 长描述。
 * 最后两项是「搜得到但看不见」的：类型入口词让「智能体 / 供需 / 课程 / 资讯」
 * 这四个入口词能命中对应分组；长描述让智能体简介、正文段落里的长尾词
 * （如「知识库」「日程」）也能被搜到。
 */
export function searchItemText(item: SearchItem): string {
  return [
    item.title,
    item.summary,
    item.category ?? '',
    item.keywords ?? '',
    item.typeSearch ?? item.typeLabel,
    item.detail ?? '',
  ]
    .join(' ')
    .trim();
}

/**
 * 检索文本归一化：小写 + **去掉所有空白**。
 *
 * 中文里空格通常不承载语义，而用户手打时经常漏掉或多加：
 * 搜「集智AI」应该和搜「集智 AI」得到同样的结果，
 * 搜「集智  AI」（多个空格）也一样。
 */
export function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

/**
 * 归一化后的子串匹配。
 *
 * 页面（`FilterRoot`）与接口（`matchItems`）**必须调用同一个函数**，
 * 否则「页面上搜得到、接口搜不到」或反之。
 */
export function textMatches(text: string, query: string): boolean {
  const q = normalizeForMatch(query);
  if (!q) return true;
  return normalizeForMatch(text).includes(q);
}

/**
 * 按关键词统计各分类的命中数（用于筛选条上的分类计数）。
 *
 * **为什么要实时更新**：筛选条上的「智能体 29」如果是**静态总数**，
 * 用户搜「飞书」之后再去点「智能体」，计数写着 29、点进去却是 0 条 ——
 * 这是坏的交互。计数应当反映「在当前关键词下该分类还能命中多少」。
 *
 * `key` 为空串表示「全部」。
 */
export function countMatchesByKey(
  entries: Array<{ key: string; text: string }>,
  query: string,
): { byKey: Map<string, number>; total: number } {
  const byKey = new Map<string, number>();
  let total = 0;
  for (const entry of entries) {
    if (!textMatches(entry.text, query)) continue;
    total += 1;
    byKey.set(entry.key, (byKey.get(entry.key) ?? 0) + 1);
  }
  return { byKey, total };
}

/**
 * 按关键词与类型过滤条目。
 *
 * - `q` 为空 → 不做文本过滤；
 * - `q` 非空 → 对可检索文本做**大小写与空白都不敏感**的子串匹配；
 * - `type` 为空或 `'all'` → 不过滤类型，否则按 type 精确相等。
 */
export function matchItems(
  items: SearchItem[],
  opts: { q?: string; type?: string } = {},
): SearchItem[] {
  const q = opts.q ?? '';
  const rawType = (opts.type ?? '').trim().toLowerCase();
  const type = !rawType || rawType === 'all' ? '' : rawType;

  return items.filter((item) => {
    if (type && item.type !== type) return false;
    return textMatches(searchItemText(item), q);
  });
}
