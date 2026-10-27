import type { IconName } from './AdminIcons';

/**
 * 后台导航树（纯数据 + 纯函数，服务端 / 客户端组件都可引用）。
 *
 * 2026-10 App Shell 拆分时从 AdminShell 迁出：AdminSidebar（菜单）、
 * AdminTopbar（面包屑 / 快速跳转）、AdminPageHeader（子页返回链接）
 * 共用这一份结构，保证三处的高亮/归属永远一致。
 * 「规划中」占位概念已移除 —— 全部 14 个模块均已落地。
 */

export type NavKey =
  | 'overview'
  | 'news'
  | 'activities'
  | 'community'
  | 'agents'
  | 'market'
  | 'courses'
  | 'partners'
  | 'leads'
  | 'site-stats'
  | 'empower'
  | 'site-contents'
  | 'media'
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
      { key: 'activities', label: '活动管理', href: '/admin/activities', icon: 'calendar' },
      { key: 'community', label: '社区专区', href: '/admin/community', icon: 'users' },
      { key: 'agents', label: '智能体工具', href: '/admin/agents', icon: 'bot' },
      { key: 'market', label: '供需市场', href: '/admin/market', icon: 'store' },
      { key: 'courses', label: '课程管理', href: '/admin/courses', icon: 'graduation' },
      { key: 'partners', label: '合作伙伴', href: '/admin/partners', icon: 'handshake' },
    ],
  },
  {
    title: '线索管理',
    items: [{ key: 'leads', label: '线索列表', href: '/admin/leads', icon: 'inbox' }],
  },
  {
    title: '站点配置',
    items: [
      { key: 'site-stats', label: '统计数字', href: '/admin/site-stats', icon: 'chart' },
      { key: 'empower', label: '八大赋能', href: '/admin/empower', icon: 'sparkles' },
      { key: 'site-contents', label: '页面文案', href: '/admin/site-contents', icon: 'fileText' },
    ],
  },
  {
    title: '系统',
    items: [
      { key: 'media', label: '媒体库', href: '/admin/media', icon: 'image' },
      { key: 'accounts', label: '管理员账号', href: '/admin/accounts', icon: 'shield' },
    ],
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
