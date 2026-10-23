/** 动态内容类目契约：数据库类目 → 复刻站列表页的分发规则。
 *
 * 复刻站 /newslist 与 /activitylist 原站没有类目筛选（只有加载更多），
 * 类目在这里只承担一件事：决定一篇 news_posts 出现在哪个列表页。
 * 约定见 docs/14-动态内容契约.md。
 */

/** 出现在 /newslist（新闻列表）的类目 */
export const NEWS_CATEGORIES = ['资讯', '沙龙'] as const;

/** 出现在 /activitylist（活动列表）的类目 */
export const ACTIVITY_CATEGORIES = ['活动'] as const;

/** 抓包快照（public-content.json）的 category_id → 列表页分流 */
export const LEGACY_CHANNEL_BY_CATEGORY_ID: Record<number, 'news' | 'activity'> = {
  10: 'news',
  16: 'activity',
};

/** 迁移快照入库时的默认类目（按 channel） */
export const DEFAULT_CATEGORY_BY_CHANNEL: Record<'news' | 'activity', string> = {
  news: '资讯',
  activity: '活动',
};

/** 复刻列表页占位符：构建管线烘焙卡片的位置标记，运行时注入 DB 卡片或兜底串 */
export const LIST_PLACEHOLDER = {
  news: '__OPC_NEWS_LIST__',
  activity: '__OPC_ACTIVITY_LIST__',
} as const;

/** 快照迁移入库的 slug 前缀：数字 id=N 的快照文章 → slug=`opc-N` */
export const LEGACY_SLUG_PREFIX = 'opc-';

/** /newsdetail 的 id 参数允许的形态：数字（快照遗留）或 slug（后台新发布） */
export const NEWSDETAIL_ID_PATTERN = /^[1-9]\d{0,9}$|^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

/** 判断 news_posts 的类目属于哪个复刻列表页 */
export function channelOfCategory(category: string): 'news' | 'activity' | null {
  if ((ACTIVITY_CATEGORIES as readonly string[]).includes(category)) return 'activity';
  if ((NEWS_CATEGORIES as readonly string[]).includes(category)) return 'news';
  return null;
}
