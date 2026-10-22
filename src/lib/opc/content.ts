/** Public reference content, compiled and sanitized at generation time.
 * Keep this module on the server: only the selected page/article reaches users.
 */
import pagesSource from './generated/pages.json' with { type: 'json' };
import detailsSource from './generated/details.json' with { type: 'json' };
import articleShell from './generated/article-shell.json' with { type: 'json' };
import zonePagesSource from './generated/zone-cities.json' with { type: 'json' };
import { isReplicaPath } from '@/lib/opc/routes';

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

type Query = Record<string, string | string[] | undefined>;
type ArticleRecord = ReplicaArticle & { date: string };
const pages = pagesSource as Record<string, ReplicaPageContent>;
const details = detailsSource as Record<string, ArticleRecord>;
const zonePages = zonePagesSource as Record<string, ReplicaPageContent>;

/**
 * 复刻站对外的站点名。
 *
 * ⚠️ 口径以《集智AI 网站.docx》与主站 `site.config.name` 为准：
 * 「集智 AI OPC 社区」（早期写作「集智AI OPC社区平台」，已收敛）。
 * 站点名收敛到这一个常量，避免各处各写一份。
 */
export const REPLICA_SITE_NAME = '集智 AI OPC 社区';

function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

function firstQuery(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Numeric identifiers are checked before an immutable lookup; no file paths. */
export function getReplicaArticle(id: string | number): ReplicaArticle | null {
  const key = String(id);
  if (!/^[1-9]\d{0,9}$/.test(key) || !Object.hasOwn(details, key)) return null;
  const article = details[key];
  return { id: article.id, title: article.title, html: article.html };
}

export function getReplicaPage(pathname: string, query: Query = {}): ReplicaPageContent | null {
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (!isReplicaPath(path) || !Object.hasOwn(pages, path)) return null;
  if (path === '/newsdetail') {
    const identifier = firstQuery(query.id) ?? '392';
    const article = getReplicaArticle(identifier);
    if (!article) return null;
    const record = details[String(article.id)];
    return {
      path,
      id: article.id,
      title: `${article.title} - ${REPLICA_SITE_NAME}`,
      html: articleShell.html
        .replace('__OPC_TITLE__', escapeText(article.title))
        .replace('__OPC_DATE__', escapeText(record.date))
        .replace('__OPC_ARTICLE__', article.html),
    };
  }
  const page = pages[path];
  const city = firstQuery(query.city);
  if (path === '/zone' && city && Object.hasOwn(zonePages, city)) {
    return { ...zonePages[city] };
  }
  return { ...page };
}
