import Link from 'next/link';
import AdminBackdrop from './AdminBackdrop';
import LogoutButton from './LogoutButton';
import { getAdminSession } from '@/lib/admin/auth';

/**
 * 管理后台共享外壳：深色顶栏 + 二级导航 + shader 背景层。
 * 由各受保护页面自行引入（login 页不用），认证检查在各页面的服务端组件里完成。
 */

const NAV = [
  { key: 'overview', label: '概览', href: '/admin' },
  { key: 'leads', label: '线索管理', href: '/admin/leads' },
  { key: 'news', label: '新闻动态', href: '/admin/news' },
] as const;

export default async function AdminShell({
  active,
  title,
  desc,
  actions,
  dbConfigured = true,
  children,
}: {
  active: 'overview' | 'leads' | 'news';
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
        <nav className="mt-3 flex gap-1">
          {NAV.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={
                  isActive
                    ? 'rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-brand-navy)] shadow-[var(--shadow-card)]'
                    : 'rounded-lg px-4 py-2 text-[13px] font-medium text-[var(--color-ink-2)] transition-colors hover:bg-white/70 hover:text-[var(--color-brand-navy)]'
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 标题区 */}
      <div className="relative mx-auto mt-8 w-full max-w-[1240px] px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
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
      </div>

      <main className="relative mx-auto mt-6 w-full max-w-[1240px] px-5 sm:px-8">{children}</main>
    </div>
  );
}
