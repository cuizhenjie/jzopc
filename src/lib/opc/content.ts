/** 公开站静态内容（参考站快照编译产物）。
 *
 * 事实源：scripts/opc-reference/ → scripts/build-opc-reference.mjs → generated/pages.json
 * 运行时只把**被选中的那一页**送到浏览器（服务端专用模块）。
 */
import pagesSource from './generated/pages.json' with { type: 'json' };

export interface ReplicaPageContent {
  html: string;
  title: string;
  path: string;
  id?: number;
}

export interface ReplicaArticle {
  id: number;
  title: string;
  html: string;
}

type Query = Record<string, string | undefined | string[]>;

const pages = pagesSource as unknown as Record<string, ReplicaPageContent>;

/**
 * 复刻站对外的站点名。
 *
 * ⚠️ 口径以《集智AI 网站.docx》与主站 `site.config.name` 为准：
 * 「集智 AI OPC 社区」（早期写作「集智AI OPC社区平台」，已收敛）。
 * 站点名收敛到这一个常量，避免各处各写一份。
 */
export const REPLICA_SITE_NAME = '集智 AI OPC 社区';

/** HTML 文本/属性值转义（运行时卡片渲染复用同一实现） */
export function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function firstQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** 取某一路由的烘焙页面；路径不在快照内 → null（由路由层决定 404）。 */
export function getReplicaPage(pathname: string, _query: Query = {}): ReplicaPageContent | null {
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (!Object.hasOwn(pages, path)) return null;
  const page = pages[path];
  return { ...page, path };
}

/** 快照里存在的全部公开路由（sitemap / llms.txt / 校验脚本共用）。 */
export function listReplicaPaths(): string[] {
  return Object.keys(pages).sort();
}
