/** 公开导航与外壳模式。参考站菜单的唯一事实源（2026-11-10 全站复刻对齐）。
 *
 * 菜单与参考站 https://jizhi-ai-opc.app.workbuddy.host/ 逐项一致：
 *   首页 / 关于集智(4 项下拉) / 大健康+AI / 八大赋能 / 供需发布 / 流量赋能 /
 *   集智商学院 / 社区动态 / 申请入驻(CTA)
 *
 * 旧路由（/newslist、/center、/traffic、/work…）由 next.config.ts 的 redirects()
 * 以 308 收敛到这里声明的正式路由，老链接不落 404。
 */
export type NavChild = { label: string; href: string };
export type NavItem = NavChild & { children?: NavChild[]; cta?: boolean };

export const publicNavigation: NavItem[] = [
  { label: '首页', href: '/' },
  {
    label: '关于集智', href: '/about', children: [
      { label: '集智简介', href: '/about#intro' },
      { label: '发展历程', href: '/about#history' },
      { label: '服务对象', href: '/about#who' },
      { label: '生态伙伴', href: '/about#eco' },
    ],
  },
  { label: '大健康+AI', href: '/health' },
  { label: '八大赋能', href: '/empower' },
  { label: '供需发布', href: '/market' },
  { label: '流量赋能', href: '/growth' },
  { label: '集智商学院', href: '/academy' },
  { label: '社区动态', href: '/news' },
  { label: '申请入驻', href: '/apply', cta: true },
];

export function normalizePublicPath(pathname: string): string {
  return pathname.toLowerCase().replace(/\/+$/, '') || '/';
}

/** 后台与运营区自带外壳，不吃公开站的导航/页脚。 */
export function publicChromeMode(pathname: string): 'home' | 'page' | 'independent' {
  const path = normalizePublicPath(pathname);
  if (/^\/(?:admin|ops)(?:\/|$)/.test(path)) return 'independent';
  return path === '/' ? 'home' : 'page';
}

/** 导航高亮：路径完全相等，或落在子路径下。锚点（#xxx）不参与匹配。 */
export function navigationMatchesPath(pathname: string, href: string): boolean {
  const path = normalizePublicPath(pathname);
  const target = normalizePublicPath(href.split('#')[0]);
  if (!target) return false;
  if (path === target) return true;
  return path.startsWith(`${target}/`);
}
