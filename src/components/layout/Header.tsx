'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
          <Link href="/apply" className="mobile-apply">申请入驻 <span aria-hidden="true">↗</span></Link>
        </nav>
      </div>
    </header>
  );
}
