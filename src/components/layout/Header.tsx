'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { navigationMatchesPath, publicNavigation } from '@/lib/site/navigation';
import BrandMark from '@/components/ui/BrandMark';

const navigation = publicNavigation.filter(item => !item.cta);
const apply = publicNavigation.find(item => item.cta)!;

/** One public header for native and captured pages; links also work before hydration. */
export default function Header({ home = false }: { home?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    const onSearch = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.matches('input,textarea,select') || target.isContentEditable)) return;
      event.preventDefault();
      const field = document.querySelector<HTMLInputElement>('[data-search-field="true"],[data-opc-search],.hero-search-input');
      if (!open && field) field.focus();
      else window.location.assign('/search');
    };
    document.addEventListener('keydown', onSearch);
    return () => document.removeEventListener('keydown', onSearch);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const background = Array.from(document.querySelectorAll<HTMLElement>('main#main,body > footer'));
    const priorInert = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    drawer.current?.querySelector<HTMLAnchorElement>('a[href]')?.focus();

    const close = () => { setOpen(false); menuButton.current?.focus(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const items = [menuButton.current, ...Array.from(drawer.current?.querySelectorAll<HTMLAnchorElement>('a[href]') ?? [])]
        .filter((item): item is HTMLButtonElement | HTMLAnchorElement => !!item);
      const first = items[0];
      const last = items.at(-1);
      const outside = !items.some(item => item === document.activeElement);
      if ((event.shiftKey && document.activeElement === first) || (outside && event.shiftKey)) {
        event.preventDefault(); last?.focus();
      } else if ((!event.shiftKey && document.activeElement === last) || outside) {
        event.preventDefault(); first?.focus();
      }
    };
    const onResize = () => { if (window.innerWidth >= 1280) close(); };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      document.body.style.overflow = overflow;
      background.forEach((element, index) => { element.inert = priorInert[index]; });
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const onDark = home && !scrolled && !open;
  return (
    <header data-public-header="" className={clsx('site-header', onDark ? 'header-on-dark' : 'header-solid')}>
      <div className="site-container header-inner">
        <a href="/" className="header-brand" aria-label="集智 AI 首页">
          <BrandMark className="header-mark-default" />
          <BrandMark light className="header-mark-on-dark" />
          <span><span className="header-brand-name">集智 AI</span><span className="header-brand-latin">JIZHI · AI OPC</span></span>
        </a>
        <nav className="desktop-nav" aria-label="主导航">
          {navigation.map(item => {
            const active = navigationMatchesPath(pathname, item.href) || item.children?.some(child => navigationMatchesPath(pathname, child.href));
            return <div className="nav-group" key={item.href}>
              <a href={item.href} className={clsx('nav-link', active && 'is-active')} aria-current={pathname === item.href ? 'page' : undefined}>
                {item.label}
                {!!item.children?.length && <svg className="nav-chevron" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.3" /></svg>}
              </a>
              {!!item.children?.length && <div className="nav-dropdown"><div>{item.children.map(child => <a href={child.href} key={child.href} aria-current={pathname === child.href ? 'page' : undefined}>{child.label}</a>)}</div></div>}
            </div>;
          })}
        </nav>
        <div className="header-actions">
          <a href="/search" className="header-search" aria-label="站内搜索" title="站内搜索">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" /><path d="m12.8 12.8 4.2 4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
          </a>
          <a href={apply.href} className="header-apply">{apply.label}<span aria-hidden="true">↗</span></a>
          <button ref={menuButton} type="button" className="menu-button" aria-controls="mobile-navigation" aria-expanded={open} aria-label={open ? '关闭菜单' : '打开菜单'} onClick={() => setOpen(value => !value)}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{open ? <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" /> : <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" />}</svg>
          </button>
        </div>
      </div>
      <div ref={drawer} id="mobile-navigation" className="mobile-drawer" hidden={!open} inert={!open}>
        <nav className="site-container" aria-label="移动端导航" onClick={event => {
          if ((event.target as Element).closest('a')) { setOpen(false); menuButton.current?.focus(); }
        }}>
          {navigation.map(item => <div className="mobile-nav-group" key={item.href}>
            <a href={item.href} className={clsx('mobile-nav-parent', navigationMatchesPath(pathname, item.href) && 'is-active')}>{item.label}<span aria-hidden="true">↗</span></a>
            {!!item.children?.length && <div className="mobile-nav-children">{item.children.map(child => <a href={child.href} key={child.href} aria-current={pathname === child.href ? 'page' : undefined}>{child.label}</a>)}</div>}
          </div>)}
          <div className="mobile-nav-group"><a href="/search" className="mobile-nav-parent">站内搜索<span aria-hidden="true">↗</span></a></div>
          <a href={apply.href} className="mobile-apply">{apply.label}<span aria-hidden="true">↗</span></a>
        </nav>
      </div>
    </header>
  );
}
