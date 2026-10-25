import Link from 'next/link';
import AdminBackdrop from './AdminBackdrop';
import LogoutButton from './LogoutButton';
import ShaderAccent from '@/components/shaders/ShaderAccent';
import { getAdminSession } from '@/lib/admin/auth';

/**
 * 管理后台共享外壳：深色顶栏 + 分组侧边栏菜单树 + shader 背景层。
 * 由各受保护页面自行引入（login 页不用），认证检查在各页面的服务端组件里完成。
 *
 * 菜单树分五组：概览 / 内容管理 / 线索管理 / 站点配置 / 系统。
 * 2026-10-25 起「规划中」模块全部落地：智能体工具 / 供需市场 / 课程管理 /
 * 社区专区 / 合作伙伴 / 统计数字 / 八大赋能 / 页面文案 / 媒体库 / 管理员账号。
 */

type NavKey =
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

type NavItem = {
  label: string;
  /** 当前高亮的导航项（有路由的才需要）。 */
  key?: NavKey;
  href?: string;
  /** 规划中：渲染为不可点的占位项，不建路由。 */
  planned?: boolean;
};

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: '概览',
    items: [{ key: 'overview', label: '仪表盘', href: '/admin' }],
  },
  {
    title: '内容管理',
    items: [
      { key: 'news', label: '新闻资讯', href: '/admin/news' },
      { key: 'activities', label: '活动管理', href: '/admin/activities' },
      { key: 'community', label: '社区专区', href: '/admin/community' },
      { key: 'agents', label: '智能体工具', href: '/admin/agents' },
      { key: 'market', label: '供需市场', href: '/admin/market' },
      { key: 'courses', label: '课程管理', href: '/admin/courses' },
      { key: 'partners', label: '合作伙伴', href: '/admin/partners' },
    ],
  },
  {
    title: '线索管理',
    items: [{ key: 'leads', label: '线索列表', href: '/admin/leads' }],
  },
  {
    title: '站点配置',
    items: [
      { key: 'site-stats', label: '统计数字', href: '/admin/site-stats' },
      { key: 'empower', label: '八大赋能', href: '/admin/empower' },
      { key: 'site-contents', label: '页面文案', href: '/admin/site-contents' },
    ],
  },
  {
    title: '系统',
    items: [
      { key: 'media', label: '媒体库', href: '/admin/media' },
      { key: 'accounts', label: '管理员账号', href: '/admin/accounts' },
    ],
  },
];

function SidebarNav({ active }: { active: NavKey }) {
  return (
    <nav
      aria-label="后台导航"
      className="self-start rounded-2xl border border-[var(--color-line)] bg-white p-3 shadow-[var(--shadow-card)] lg:sticky lg:top-4"
    >
      {/* 移动端：分组平铺成两/三列小卡片；桌面（lg+）：纵向菜单树 */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:block lg:space-y-5">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-2.5 text-[11px] font-semibold tracking-wide text-[var(--color-ink-3)]">{group.title}</p>
            <ul className="mt-1.5 space-y-0.5">
              {group.items.map((item) => (
                <li key={item.label}>
                  {item.planned ? (
                    <span
                      title="功能规划中，敬请期待"
                      aria-disabled="true"
                      className="flex cursor-not-allowed items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-[var(--color-ink-3)]"
                    >
                      {item.label}
                      <span className="shrink-0 rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-ink-3)]">
                        规划中
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={item.href!}
                      aria-current={item.key === active ? 'page' : undefined}
                      className={
                        item.key === active
                          ? 'block rounded-lg bg-[var(--color-brand-navy)] px-2.5 py-1.5 text-[13px] font-semibold text-white shadow-[var(--shadow-card)]'
                          : 'block rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-brand-navy)]'
                      }
                    >
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

export default async function AdminShell({
  active,
  title,
  desc,
  actions,
  dbConfigured = true,
  children,
}: {
  active: NavKey;
  title: string;
  desc?: string;
  /** 标题右侧的操作区（如「新建」「导出」按钮）。 */
  actions?: React.ReactNode;
  dbConfigured?: boolean;
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  return (
    <div
      data-nav-theme="light"
      className="relative min-h-[78vh] overflow-hidden pb-24 pt-10 sm:pt-14"
      // CSS 渐变兜底层：shader 加载前首帧 / WebGL 不可用时的背景（与 shell 变体同色系）
      style={{ background: 'linear-gradient(160deg, #f6f9fc 0%, #eef4fa 60%, #ffffff 100%)' }}
    >
      <AdminBackdrop variant="shell" />

      <div className="relative mx-auto w-full max-w-[1240px] px-5 sm:px-8">
        {/* 顶栏 */}
        <header className="flex items-center justify-between rounded-2xl bg-[var(--color-brand-navy)] px-5 py-3.5 shadow-[var(--shadow-card)] sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-[15px] font-semibold tracking-wide text-white">
              集智 · 管理后台
            </Link>
            <Link
              href="/"
              target="_blank"
              className="hidden rounded-md bg-white/10 px-2 py-1 text-[11px] text-white/70 transition-colors hover:bg-white/20 hover:text-white sm:inline-block"
            >
              查看站点 ↗
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {session && (
              <span className="hidden items-center gap-2 text-[12px] text-white/70 sm:flex">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15 text-[11px] font-semibold text-white">
                  {session.displayName.slice(0, 1)}
                </span>
                {session.displayName}
                {session.via === 'master' && (
                  <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                    主口令
                  </span>
                )}
              </span>
            )}
            <LogoutButton />
          </div>
        </header>

        {/* 侧边栏菜单树 + 内容列（移动端侧边栏平铺到标题上方，不折叠） */}
        <div className="mt-3 grid gap-5 lg:grid-cols-[212px_minmax(0,1fr)] lg:gap-6">
          <SidebarNav active={active} />

          <div className="min-w-0">
            {/* 标题区：shader 组件包的 Accent 原语做页头点缀条 */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <ShaderAccent variant="brand" className="mb-3 max-w-[220px]" />
                <h1 className="text-[24px] font-semibold text-[var(--color-brand-navy)]">{title}</h1>
                {desc && <p className="mt-1.5 text-[13px] text-[var(--color-ink-2)]">{desc}</p>}
              </div>
              <div className="flex items-center gap-3">
                {!dbConfigured && (
                  <span className="rounded-full bg-amber-50 px-3.5 py-1.5 text-[12px] font-medium text-amber-700 ring-1 ring-amber-200">
                    未连接 Supabase · 数据不可用
                  </span>
                )}
                {actions}
              </div>
            </div>

            <main className="mt-6">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
