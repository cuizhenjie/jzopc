/** Public OPC navigation only. Backend, account data and third-party sub-sites are excluded.
 * `/computingresource`（GPU资源）已于 2026-10 下线：菜单、特性卡与页面一并移除。 */
export const replicaPaths = [
  '/', '/agent', '/market', '/center', '/starproject', '/community', '/work',
  '/about', '/newslist', '/activitylist', '/newsdetail',
  '/zone', '/starjoin', '/opcapply', '/opclogin', '/opcregister',
  '/opcforgotpassword', '/myinfo',
] as const;

export type ReplicaPath = (typeof replicaPaths)[number];
const paths = new Set<string>(replicaPaths);
const referenceHosts = new Set(['opcstore.com', 'www.opcstore.com']);
const queryKeys = new Set(['id', 'formType', 'city', 'tab', 'category', 'q', 'page', 'type', 'courseId', 'serverName', 'serverCompute', 'serverPrice', 'rentalType']);

export function isReplicaPath(pathname: string): pathname is ReplicaPath {
  return paths.has(pathname.toLowerCase().replace(/\/$/, '') || '/');
}

/** Converts observed reference URLs to local navigation; never returns an external URL. */
export function resolveReferenceLocation(input: string): string | null {
  if (!input || /[\u0000-\u0020\u007f\\]/.test(input)) return null;
  let candidate = input;
  if (/^https?:/i.test(candidate)) {
    let url: URL;
    try { url = new URL(candidate); } catch { return null; }
    if (!referenceHosts.has(url.hostname) || url.username || url.password || url.port) return null;
    candidate = url.hash || url.pathname + url.search;
  }
  if (/^\/webnew\/index\.html#/i.test(candidate)) {
    candidate = candidate.slice(candidate.indexOf('#') + 1);
  } else if (candidate.startsWith('#/')) candidate = candidate.slice(1);
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('#')) return null;
  const question = candidate.indexOf('?');
  const rawPath = question < 0 ? candidate : candidate.slice(0, question);
  let pathname: string;
  try { pathname = decodeURIComponent(rawPath).toLowerCase().replace(/\/$/, '') || '/'; }
  catch { return null; }
  if (/[\s%?#:\\]/.test(pathname) || pathname.split('/').some(p => p === '.' || p === '..')) return null;
  if (!isReplicaPath(pathname)) return null;
  const source = new URLSearchParams(question < 0 ? '' : candidate.slice(question + 1));
  const query = new URLSearchParams();
  for (const [key, value] of source) {
    if (queryKeys.has(key) && value.length <= 300 && !/[\u0000-\u001f\u007f]/.test(value)) query.set(key, value);
  }
  return pathname + (query.size ? `?${query}` : '');
}
