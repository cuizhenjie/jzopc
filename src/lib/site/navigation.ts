/** Small, shared public navigation. Safe to import from a client component. */
export type NavChild = { label: string; href: string };
export type NavItem = NavChild & { children?: NavChild[]; cta?: boolean };

export const publicNavigation: NavItem[] = [
  // 关于集智的四个子页（简介/历程/服务对象/生态伙伴）已于 2026-10-23 下线，
  // 内容统一收敛进 /about 单页 —— 导航只保留顶层入口。
  { label: '关于集智', href: '/about' },
  {
    label: '八大赋能', href: '/empower/space', children: [
      { label: '集智空间', href: '/empower/space' },
      { label: '智能体', href: '/empower/agents' },
      { label: '算力超市', href: '/empower/compute' },
      { label: '集智学院', href: '/empower/academy' },
      { label: '企服超市', href: '/empower/enterprise' },
      { label: '供需市场', href: '/empower/market' },
      { label: '流量赋能', href: '/empower/traffic' },
      { label: '资本政策', href: '/empower/capital' },
    ],
  },
  { label: '智能体', href: '/agent' },
  { label: '供需市场', href: '/market' },
  { label: '流量超市', href: '/traffic' },
  { label: '集智商学院', href: '/center' },
  {
    label: '社区动态', href: '/newslist', children: [
      { label: '沙龙', href: '/newslist' },
      { label: '活动资讯', href: '/activitylist' },
    ],
  },
  { label: '申请入驻', href: '/apply', cta: true },
];

export function normalizePublicPath(pathname: string): string {
  return pathname.toLowerCase().replace(/\/+$/, '') || '/';
}

const independentPaths = new Set([
  '/opclogin', '/opcregister', '/opcforgotpassword', '/myinfo', '/opcapply',
]);

/** Account shells and both operations areas own their chrome and scroll layout. */
export function publicChromeMode(pathname: string): 'home' | 'page' | 'independent' {
  const path = normalizePublicPath(pathname);
  if (/^\/(?:admin|ops)(?:\/|$)/.test(path) || independentPaths.has(path)) return 'independent';
  return path === '/' || path === '/webnew/index.html' ? 'home' : 'page';
}

export function navigationMatchesPath(pathname: string, href: string): boolean {
  const path = normalizePublicPath(pathname);
  if (path === href || path.startsWith(`${href}/`)) return true;
  if (href === '/agent') return path === '/agents' || path.startsWith('/agents/');
  if (href === '/center') return path === '/academy' || path.startsWith('/academy/');
  if (href === '/newslist') return path === '/news' || path.startsWith('/news/');
  return false;
}
