/** 动态内容的 id / slug 契约。
 *
 * 2026-11-10 全站复刻后，公开站只剩**一条**动态列表（/news），
 * 旧的 /newslist + /activitylist 双通道与「类目决定进哪个列表」的规则一并下线：
 *   - 类目词表的唯一事实源是后台 `src/lib/admin/news-schema.ts` 的 NEWS_CATEGORIES
 *     （与前台 /news 的筛选 chips 逐字一致）；
 *   - 前台列表按 `data-opc-block="news-list"` 标记定位容器（见 docs/17）。
 * 约定见 docs/14-动态内容契约.md。
 */

/** 快照迁移入库的 slug 前缀：数字 id=N 的快照文章 → slug=`opc-N` */
export const LEGACY_SLUG_PREFIX = 'opc-';

/** /newsdetail 的 id 参数允许的形态：数字（快照遗留）或 slug（后台新发布） */
export const NEWSDETAIL_ID_PATTERN = /^[1-9]\d{0,9}$|^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
