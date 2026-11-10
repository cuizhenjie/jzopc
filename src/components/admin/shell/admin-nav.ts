import type { IconName } from './AdminIcons';

/**
 * 后台导航树（纯数据 + 纯函数，服务端 / 客户端组件都可引用）。
 *
 * 2026-10 App Shell 拆分时从 AdminShell 迁出：AdminSidebar（菜单）、
 * AdminTopbar（面包屑 / 快速跳转）、AdminPageHeader（子页返回链接）
 * 共用这一份结构，保证三处的高亮/归属永远一致。
 * 2026-11 后台瘦身：仅保留 6 个维护模块（仪表盘 / 新闻资讯 / banner 管理 /
 * 线索列表 / 供需数据 / 管理员账号），其余维护功能已下线
 * （活动、社区、智能体、课程、合作伙伴、统计数字、八大赋能、媒体库）。
 * 前台公开页仍直接从数据库读取对应数据，不受影响。
 * 2026-11-10 首页 Banner 归入「内容管理」组（与新闻资讯、供需数据并列），
 * 原「站点配置」组随之撤销。
 */

export type NavKey =
  | 'overview'
  | 'news'
  | 'market'
  | 'leads'
  | 'banners'
  | 'accounts';

export type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  icon: IconName;
};

export type NavGroup = { title: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    title: '概览',
    items: [{ key: 'overview', label: '仪表盘', href: '/admin', icon: 'dashboard' }],
  },
  {
    title: '内容管理',
    items: [
      { key: 'news', label: '新闻资讯', href: '/admin/news', icon: 'newspaper' },
      { key: 'market', label: '供需数据', href: '/admin/market', icon: 'store' },
      { key: 'banners', label: '首页 Banner', href: '/admin/banners', icon: 'image' },
    ],
  },
  {
    title: '线索管理',
    items: [{ key: 'leads', label: '线索列表', href: '/admin/leads', icon: 'inbox' }],
  },
  {
    title: '系统',
    items: [{ key: 'accounts', label: '管理员账号', href: '/admin/accounts', icon: 'shield' }],
  },
];

/**
 * AdminChrome 需要的会话字段。layout 是服务端组件，跨「服务器 → 客户端」
 * 边界只传这几个可序列化字段（exp/uid 等留在服务端，壳层用不到）。
 */
export type AdminChromeSession = {
  displayName: string;
  username: string;
  /** 登录通道：account = 管理员账号；master = OPS_TOKEN 恢复主口令 */
  via: 'account' | 'master';
};

/** 面包屑 / 快速跳转用的平铺清单（带所属分组名）。 */
export const FLAT_NAV: (NavItem & { groupTitle: string })[] = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupTitle: group.title })),
);

export type NavMatch = { item: NavItem; group: NavGroup };

/** 去尾部斜杠（'/admin/news/' → '/admin/news'），根路径保持原样。 */
function normalizePath(p: string): string {
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}

/**
 * 按路径找当前导航项（最长前缀优先，子页归属到所属模块）。
 * 注意 '/admin'（仪表盘）只做**全等**匹配 —— 否则它会前缀命中所有后台路径。
 */
export function findNavByPath(pathname: string): NavMatch | null {
  const path = normalizePath(pathname);
  let best: NavMatch | null = null;
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const hit =
        item.href === '/admin'
          ? path === '/admin'
          : path === item.href || path.startsWith(`${item.href}/`);
      if (hit && (best === null || item.href.length > best.item.href.length)) {
        best = { item, group };
      }
    }
  }
  return best;
}

export function findNavByKey(key: NavKey): NavItem | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.key === key) return item;
    }
  }
  return null;
}
