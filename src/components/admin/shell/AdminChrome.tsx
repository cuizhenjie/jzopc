'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import ShaderBackdrop from '@/components/shaders/ShaderBackdrop';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';
import type { AdminChromeSession } from './admin-nav';

/**
 * 管理后台 App Shell（layout 级持久壳）。
 *
 * 为什么搬到 layout：侧栏 / 顶栏 / shader 背景只在首次进入 /admin 时挂载一次，
 * 页面间导航只替换滚动区内容 —— 侧栏不重挂载、WebGL canvas 不重建（省掉每次
 * 导航的 shader 初始化开销），折叠偏好等本地状态也自然保留。
 *
 * 布局：左固定侧栏（lg+ 可折叠成图标栏；以下变移动端离屏抽屉）+ 右列
 * （粘性顶栏 + 独立滚动的功能区）。登录页 /admin/login 不套此外壳，
 * 保持原有全屏暗色卡片视觉。
 */

const SIDEBAR_STORE_KEY = 'jz-admin-sidebar';

export default function AdminChrome({
  session,
  children,
}: {
  session: AdminChromeSession | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // SSR 按桌面端渲染（后台以桌面使用为主），挂载后按真实视口校正；
  // 折叠态只在 lg+ 生效 —— 避免「桌面折叠后缩窗」把移动抽屉也变成图标栏。
  const [isDesktop, setIsDesktop] = useState(true);

  // 挂载后读本地折叠偏好（在 effect 里读，避免 SSR/CSR 不一致）
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_STORE_KEY) === 'collapsed');
    } catch {
      // 隐私模式等读不到 localStorage 就当作未折叠
    }
    setPrefsLoaded(true);
  }, []);

  // 偏好持久化：只在初始读取落地之后的变更写回（不拿默认值覆盖已存偏好）
  useEffect(() => {
    if (!prefsLoaded) return;
    try {
      window.localStorage.setItem(SIDEBAR_STORE_KEY, collapsed ? 'collapsed' : 'expanded');
    } catch {
      // 写不进就算了，本次会话内仍然生效
    }
  }, [collapsed, prefsLoaded]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // 路由变化自动收起移动端抽屉
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // 抽屉打开时：Esc 关闭 + 锁背景滚动
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [drawerOpen]);

  // 登录页绕过：不渲染侧栏/顶栏，children（全屏暗色卡片）原样透出
  if (pathname === '/admin/login') return <>{children}</>;

  const effectiveCollapsed = isDesktop && collapsed;

  return (
    <div
      data-collapsed={effectiveCollapsed ? '' : undefined}
      className="admin-app relative flex h-dvh min-h-[560px] w-full overflow-hidden bg-[var(--color-surface)] text-[var(--color-ink)]"
    >
      {/* 移动端抽屉遮罩（点击关闭；lg+ 永不出现） */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="关闭菜单"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-30 cursor-default bg-[var(--color-brand-navy)]/40 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <AdminSidebar
        session={session}
        collapsed={effectiveCollapsed}
        drawerOpen={drawerOpen}
        onToggleCollapsed={() => setCollapsed((v) => !v)}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      {/* 右列：shader 背景挂在本列（不在滚动区内）——功能区滚动时背景不动 */}
      <div
        className="relative flex min-w-0 flex-1 flex-col"
        // CSS 渐变兜底层：shader 挂载前首帧 / WebGL 不可用时的背景（与 shell 变体同色系）
        style={{ background: 'linear-gradient(160deg, #f6f9fc 0%, #eef4fa 60%, #ffffff 100%)' }}
      >
        <ShaderBackdrop variant="shell" className="z-0" />
        <AdminTopbar session={session} drawerOpen={drawerOpen} onOpenDrawer={() => setDrawerOpen(true)} />
        {/* 功能区：独立滚动。不能再包 <main>（SiteChrome 已渲染全文档唯一 main） */}
        <section aria-label="功能区" className="relative z-10 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-5 py-6 sm:px-8 lg:py-8">{children}</div>
        </section>
      </div>
    </div>
  );
}
