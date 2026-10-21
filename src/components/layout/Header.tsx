'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { nav, contentReady, type NavItem } from '@/lib/site/config';
import BrandMark from '@/components/ui/BrandMark';

const navigation = nav.filter((item) => !item.cta);
function visibleChildren(item: NavItem) {
  return (item.children ?? []).filter((child) => contentReady[child.href] !== false);
}

function Logo() {
  return (
    <Link href="/" className="header-brand">
      <BrandMark className="header-mark-default" />
      <BrandMark light className="header-mark-on-dark" />
      <span><span className="header-brand-name">集智 AI</span><span className="header-brand-latin">JIZHI · AI OPC</span></span>
      <span className="sr-only">首页</span>
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [darkTop, setDarkTop] = useState(true);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /**
   * ⌘K / Ctrl+K → 站内搜索。
   *
   * 页面上已经有搜索框时优先聚焦它（/search、/agents、/market），
   * 否则跳到 /search。**输入框里不劫持快捷键** —— 用户正在打字时按 ⌘K
   * 应该是插入字符，而不是把页面跳走。
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== 'k') return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      const field = document.querySelector<HTMLInputElement>('[data-search-field="true"]');
      if (field) {
        field.focus();
        return;
      }
      router.push('/search');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [router]);

  useEffect(() => {
    setOpen(false);
    setDarkTop(document.querySelector('[data-nav-theme]')?.getAttribute('data-nav-theme') === 'dark');
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const firstLink = drawer.current?.querySelector<HTMLAnchorElement>('a');
    firstLink?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        menuButton.current?.focus();
      }
      if (event.key !== 'Tab') return;
      const links = Array.from(drawer.current?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? []);
      const first = menuButton.current;
      const last = links.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const closeMenu = (href?: string) => {
    setOpen(false);
    if (href === pathname || href?.startsWith('#')) menuButton.current?.focus();
  };

  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
  const onDark = !scrolled && darkTop && !open;

  return (
    <header className={clsx('site-header', onDark && 'header-on-dark', (scrolled || open) && 'header-solid')}>
      <div className="site-container header-inner">
        <Logo />
        <nav className="desktop-nav" aria-label="主导航">
          {navigation.map((item) => {
            const children = visibleChildren(item);
            return (
              <div key={item.label} className="nav-group">
                <Link href={item.href} className={clsx('nav-link', isActive(item.href) && 'is-active')} aria-current={pathname === item.href ? 'page' : undefined}>
                  {item.label}
                  {children.length > 0 && <svg viewBox="0 0 12 12" className="nav-chevron" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.3" /></svg>}
                </Link>
                {children.length > 0 && <div className="nav-dropdown"><div>{children.map((child) => <Link key={child.href} href={child.href} aria-current={pathname === child.href ? 'page' : undefined}>{child.label}</Link>)}</div></div>}
              </div>
            );
          })}
        </nav>
        <div className="header-actions">
          {/* 全局搜索入口。
              颜色用 currentColor 跟随页头：浅色页头是品牌深蓝，深色页头是白色
              （globals.css 里 .site-header / .header-on-dark 决定 color），
              描边用 color-mix 取 30% 透明度 —— 深色页头下等价于
              .header-on-dark .menu-button 的半透明白描边，不需要改 globals.css。 */}
          <Link
            href="/search"
            aria-label="站内搜索"
            title="站内搜索"
            className="hidden h-11 w-11 items-center justify-center rounded-lg border border-[color:color-mix(in_srgb,currentColor_30%,transparent)] text-current transition-colors hover:bg-[color:color-mix(in_srgb,currentColor_8%,transparent)] lg:inline-flex"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12.8 12.8 17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </Link>
          <Link href="/apply" className="header-apply">申请入驻 <span aria-hidden="true">↗</span></Link>
          <button ref={menuButton} type="button" className="menu-button" onClick={() => setOpen((value) => !value)} aria-label={open ? '关闭菜单' : '打开菜单'} aria-expanded={open} aria-controls="mobile-navigation">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{open ? <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" /> : <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" />}</svg>
          </button>
        </div>
      </div>
      <div ref={drawer} id="mobile-navigation" className="mobile-drawer" hidden={!open} inert={!open}>
        <nav className="site-container" aria-label="移动端导航" onClick={(event) => { const link = (event.target as HTMLElement).closest('a'); if (link) closeMenu(link.getAttribute('href') ?? undefined); }}>
          {navigation.map((item) => <div className="mobile-nav-group" key={item.label}>
            <Link href={item.href} className={clsx('mobile-nav-parent', isActive(item.href) && 'is-active')}>{item.label}<span aria-hidden="true">↗</span></Link>
            {visibleChildren(item).length > 0 && <div className="mobile-nav-children">{visibleChildren(item).map((child) => <Link href={child.href} key={child.href}>{child.label}</Link>)}</div>}
          </div>)}
          {/* 移动端搜索入口：复用抽屉里已有的分组与条目样式，不新增 CSS */}
          <div className="mobile-nav-group">
            <Link href="/search" className={clsx('mobile-nav-parent', isActive('/search') && 'is-active')}>站内搜索<span aria-hidden="true">↗</span></Link>
          </div>
          <Link href="/apply" className="mobile-apply">申请入驻 <span aria-hidden="true">↗</span></Link>
        </nav>
      </div>
    </header>
  );
}
