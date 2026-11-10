/** 公开站路由表。
 *
 * 2026-11-10 全站复刻对齐参考站后，公开路由就是参考站的 10 个页面
 * （+ DB 驱动的 /newsdetail）。八大赋能的 8 个详情页是**原生路由**
 * （src/app/empower/[slug]），不在复刻快照内。
 *
 * 旧路由（/newslist、/center、/traffic、/work、/starproject…）由
 * next.config.ts 的 redirects() 以 308 收敛到这里声明的正式路由。
 */
export const replicaPaths = [
  '/', '/about', '/health', '/empower', '/market',
  '/growth', '/academy', '/news', '/newsdetail',
  '/apply', '/agent',
] as const;

export type ReplicaPath = (typeof replicaPaths)[number];
const paths = new Set<string>(replicaPaths);

/** 参考站域名（抓取快照时的来源站）。 */
const referenceHosts = new Set([
  'jizhi-ai-opc.app.workbuddy.host',
  'jizhi-ai-opc.app',
]);

const queryKeys = new Set(['id', 'city', 'cat', 'q', 'page']);

export function isReplicaPath(pathname: string): pathname is ReplicaPath {
  return paths.has(pathname.toLowerCase().replace(/\/$/, '') || '/');
}

/** 把参考站 URL 规整为站内地址；任何外部地址都不会被原样返回。 */
export function resolveReferenceLocation(input: string): string | null {
  if (!input || /[\u0000-\u0020\u007f\\]/.test(input)) return null;
  let candidate = input;
  if (/^https?:/i.test(candidate)) {
    let url: URL;
    try { url = new URL(candidate); } catch { return null; }
    if (!referenceHosts.has(url.hostname) || url.username || url.password || url.port) return null;
    candidate = url.pathname + url.search;
  }
  if (candidate.startsWith('#/')) candidate = candidate.slice(1);
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('#')) return null;
  const question = candidate.indexOf('?');
  const rawPath = question < 0 ? candidate : candidate.slice(0, question);
  let pathname: string;
  try { pathname = decodeURIComponent(rawPath).toLowerCase().replace(/\/$/, '') || '/'; }
  catch { return null; }
  if (/[\s%?#:\\]/.test(pathname) || pathname.split('/').some((p) => p === '.' || p === '..')) return null;
  if (!isReplicaPath(pathname)) return null;
  const source = new URLSearchParams(question < 0 ? '' : candidate.slice(question + 1));
  const query = new URLSearchParams();
  for (const [key, value] of source) {
    if (queryKeys.has(key) && value.length <= 300 && !/[\u0000-\u001f\u007f]/.test(value)) query.set(key, value);
  }
  return pathname + (query.size ? `?${query}` : '');
}
