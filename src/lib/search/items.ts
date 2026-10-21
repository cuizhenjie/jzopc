import type { Agent, Course, MarketItem, NewsPost } from '@/lib/data/seed';
import { agentCategories } from '@/lib/site/config';
import type { SearchItem } from './matcher';

/**
 * 站内内容的**统一条目投影**。
 *
 * ## 为什么要有这个文件
 *
 * 搜索有三个消费方：供需页、智能体页、全局搜索页。如果每个页面各自拼
 * `data-filter-text`，同一个词在三处会得到**不同的结果**——
 * 例如 /market 搜「需求」是 0 条（该页就列着 4 条需求），
 * 而 /search 搜「需求」能搜到。同一个功能、三个行为，这跟「统一 UI」的目标直接冲突。
 *
 * 所以这里把「一条内容 → 可检索文本」这件事**收成唯一一份定义**：
 * 列表页与全局索引都调用同一批转换函数，语料逐字相同。
 *
 * ## 约束
 *
 * 只 import 类型与纯数据模块（`@/lib/data/seed` 的类型、`@/lib/site/config` 的常量），
 * **不碰数据访问层**（`@/lib/queries`）—— 列表页是服务端组件、数据访问层也是服务端，
 * 但保持这个文件轻量，可以让匹配逻辑在客户端复用（见 `matcher.ts` 的 isomorphic 约束）。
 */

/** 智能体分类 slug（office）→ 中文名（办公） */
const CATEGORY_NAMES = new Map<string, string>(agentCategories.map((c) => [c.slug, c.name]));

/**
 * 类型入口词：让「智能体 / 供需 / 课程 / 资讯」这四个词能搜到对应分组。
 *
 * 逐条计算而不是按类型固定 —— 需求方条目的入口词是「供需 需求」，
 * 供给方是「供需 供给」：搜「需求」不该把供给方也带出来。
 */
const AGENT_ENTRY_WORDS = '智能体';
const COURSE_ENTRY_WORDS = '课程';
const NEWS_ENTRY_WORDS = '动态 资讯 社区动态';

export function agentToSearchItem(agent: Agent): SearchItem {
  return {
    type: 'agent',
    typeLabel: '智能体',
    typeSearch: AGENT_ENTRY_WORDS,
    title: agent.name,
    summary: agent.summary,
    href: `/agents/${agent.slug}`,
    // 分类用中文名（用户搜「办公」而不是 slug「office」）
    category: CATEGORY_NAMES.get(agent.category) ?? agent.category,
    keywords: agent.tags.join(' '),
    // 简介里常有摘要没写的长尾词（知识库、日程、纪要…）
    detail: agent.description,
  };
}

export function marketToSearchItem(item: MarketItem): SearchItem {
  return {
    type: 'market',
    // 展示名区分需求方 / 供给方，保留市场页原有的语义
    typeLabel: item.type === 'demand' ? '需求' : '供给',
    typeSearch: item.type === 'demand' ? '供需 需求' : '供需 供给',
    title: item.title,
    summary: item.summary,
    href: `/market/${item.slug}`,
    category: item.category,
    keywords: `${item.org_name} ${item.tags.join(' ')}`,
    detail: (item.body ?? []).join(' '),
  };
}

export function courseToSearchItem(course: Course): SearchItem {
  return {
    type: 'course',
    typeLabel: '课程',
    typeSearch: COURSE_ENTRY_WORDS,
    title: course.title,
    summary: course.summary,
    href: `/academy/courses/${course.slug}`,
    category: course.track,
    keywords: `${course.mentor} ${course.tags.join(' ')}`,
    detail: (course.body ?? []).join(' '),
  };
}

export function newsToSearchItem(post: NewsPost): SearchItem {
  return {
    type: 'news',
    typeLabel: '动态',
    typeSearch: NEWS_ENTRY_WORDS,
    title: post.title,
    summary: post.summary,
    href: `/news/${post.slug}`,
    category: post.category,
    keywords: post.author,
    detail: (post.body ?? []).join(' '),
  };
}
