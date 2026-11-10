import type { HomeBannerInput } from './resources';

/**
 * 资源模块的字段配置与「schema 解析结果 ↔ 表行」映射。
 *
 * 2026-11 后台瘦身：仅保留供需数据（market）与首页 Banner 的映射。
 * 2026-11-10 供需数据改为直读 /market 表单提交（leads 表 lead_type='market'，
 * 见 src/lib/admin/data.ts 的 listMarketSubmissions），market_items 的手工
 * 维护 CRUD 随之下线，这里只留首页 Banner 的 toRow。
 */

export const homeBannerToRow = (input: HomeBannerInput): Record<string, unknown> => ({
  image_url: input.image_url,
  alt: input.alt,
  sort_order: input.sort_order,
  published: input.published,
});
