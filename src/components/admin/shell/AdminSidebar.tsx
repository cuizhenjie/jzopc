'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import ShaderBackdrop from '@/components/shaders/ShaderBackdrop';
import BrandMark from '@/components/ui/BrandMark';
import LogoutButton from '@/components/admin/LogoutButton';
import { NAV_GROUPS, findNavByPath, type AdminChromeSession } from './admin-nav';
import { AdminIcon } from './AdminIcons';

/**
 * 后台左侧栏：深海军蓝底 + sidebar shader 低速流动。
 * lg+ 是普通 flex 子元素（可折叠成 72px 图标栏，宽度过渡动画）；
 * lg 以下是固定定位的离屏抽屉（280px，由 AdminChrome 控制开合）。
 * 折叠态由 AdminChrome 传入，且已按视口过滤 —— 移动端抽屉永远完整展开。
 */
export default function AdminSidebar({
  session,
  collapsed,
  drawerOpen,
  onToggleCollapsed,
  onCloseDrawer,
}: {
  session: AdminChromeSession | null;
  collapsed: boolean;
  drawerOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseDrawer: () => void;
}) {
  const pathname = usePathname();
  const active = findNavByPath(pathname);

  return (
    <aside
      aria-label="后台导航"
      className={clsx(
        // lg+ 必须是 relative（而非 static）：内部 ShaderBackdrop 是 absolute inset-0，
        // static 的 aside 不是包含块，shader 会锚到整个 .admin-app 全宽渲染
        'fixed inset-y-0 left-0 z-40 flex w-[280px] shrink-0 flex-col lg:relative lg:z-auto',
        'transition-[width,transform] duration-200 ease-out motion-reduce:transition-none',
        drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        // 折叠/展开只保留一个 lg:w 类，避免任意值类之间靠生成顺序定胜负
        collapsed ? 'lg:w-[var(--admin-sidebar-w-collapsed)]' : 'lg:w-[var(--admin-sidebar-w)]',
      )}
      // CSS 渐变兜底层：sidebar shader 挂载前首帧 / WebGL 不可用时的深海军蓝底（色值限 logo 色板）
      style={{ background: 'linear-gradient(180deg, #142F59 0%, #0E3769 60%, #152E56 100%)' }}
    >
      <ShaderBackdrop variant="sidebar" />
      <div className="relative z-10 flex h-full flex-col">
        {/* 品牌区：折叠时纵向排（mark + 折叠钮），展开时横排（mark + 文字 + 按钮） */}
        <div
          className={clsx(
            'flex shrink-0 border-b border-white/10',
            collapsed ? 'flex-col items-center gap-1 px-2 py-3' : 'h-16 items-center gap-2.5 px-4',
          )}
        >
          <Link
            href="/admin"
            className={clsx('flex min-w-0 items-center', collapsed ? 'justify-center py-0.5' : 'gap-2.5')}
            title={collapsed ? '集智 AI · 管理后台' : undefined}
          >
            <BrandMark light className={collapsed ? 'h-8 w-[31px]' : undefined} />
            {!collapsed && (
              <span className="flex flex-col leading-tight">
                <span className="text-[13px] font-semibold text-white">集智 AI</span>
                <span className="mt-0.5 text-[11px] text-white/55">管理后台</span>
              </span>
            )}
          </Link>
          {/* 移动端抽屉的关闭钮（lg+ 隐藏，由折叠钮顶替其位置） */}
          <button
            type="button"
            onClick={onCloseDrawer}
            aria-label="关闭菜单"
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            <AdminIcon name="x" />
          </button>
          {/* 桌面端折叠/展开钮 */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
            aria-pressed={collapsed}
            title={collapsed ? '展开侧栏' : '折叠侧栏'}
            className={clsx(
              'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/50 transition-colors hover:bg-white/10 hover:text-white',
              collapsed ? 'ml-0' : 'ml-auto',
              'hidden lg:grid',
            )}
          >
            <AdminIcon name={collapsed ? 'chevronsRight' : 'chevronsLeft'} />
          </button>
        </div>

        {/* 菜单树：分组标题（折叠时退化为细分隔线）+ 图标 + 文字 */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="pb-5 last:pb-0">
              {collapsed ? (
                <div aria-hidden="true" className="mx-auto mb-3 h-px w-6 bg-white/15" />
              ) : (
                <p className="px-2.5 pb-1.5 text-[10.5px] font-semibold tracking-[0.14em] text-white/40">
                  {group.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = active?.item.key === item.key;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        aria-current={isActive ? 'page' : undefined}
                        className={clsx(
                          'relative flex items-center rounded-lg text-[13px] transition-colors',
                          collapsed ? 'justify-center px-1.5 py-2.5' : 'gap-2.5 px-2.5 py-2',
                          isActive
                            ? 'bg-white/12 font-semibold text-white'
                            : 'font-medium text-white/70 hover:bg-white/8 hover:text-white',
                        )}
                      >
                        {/* 激活态左缘强调条（青绿，3px，绝对定位于链接内部） */}
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--color-brand-teal)]"
                          />
                        )}
                        <AdminIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* 底部：用户信息 + 查看站点 / 退出 */}
        <div className="shrink-0 border-t border-white/10 p-3">
          <div className={clsx('flex items-center gap-2.5', collapsed && 'flex-col gap-2')}>
            <span
              title={session?.displayName}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-brand-teal)]/20 text-[12px] font-semibold text-white"
            >
              {(session?.displayName ?? '访').slice(0, 1)}
            </span>
            {session && !collapsed && (
              <span className="flex min-w-0 flex-col items-start leading-tight">
                <span className="max-w-full truncate text-[12px] font-medium text-white/85">
                  {session.displayName}
                </span>
                {session.via === 'master' ? (
                  <span className="mt-1 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">
                    主口令
                  </span>
                ) : (
                  <span className="mt-0.5 max-w-full truncate text-[10.5px] text-white/50">
                    @{session.username}
                  </span>
                )}
              </span>
            )}
          </div>
          <div className={clsx('mt-3 flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between')}>
            {!collapsed && (
              <Link
                href="/"
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11.5px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                查看站点
                <AdminIcon name="externalLink" className="h-3.5 w-3.5" />
              </Link>
            )}
            <LogoutButton compact={collapsed} />
          </div>
        </div>
      </div>
    </aside>
  );
}
