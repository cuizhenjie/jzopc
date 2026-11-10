'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { navigationMatchesPath, publicNavigation } from '@/lib/site/navigation';

const navigation = publicNavigation.filter((item) => !item.cta);
const apply = publicNavigation.find((item) => item.cta)!;

const CHEVRON = (
  <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** 参考站顶栏：结构与 class 全部对齐参考站 DOM，样式由 /opc/reference/main.css 提供。 */
export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [float, setFloat] = useState(false);
  const [solid, setSolid] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);

  // 首屏封面页：导航透明浮在 banner 上，滚过 banner 后转白底。
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const hero = document.querySelector('.hero');
      const navH = Number.parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--nav-h'),
        10,
      ) || 74;
      if (hero) {
        const past = window.scrollY > (hero.getBoundingClientRect().height - navH - 12);
        setFloat(!past);
        setSolid(past);
      } else {
        setFloat(false);
        setSolid(window.scrollY > 12);
      }
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [pathname]);

  // 路由变化收起移动端抽屉
  useEffect(() => { setOpen(false); }, [pathname]);

  // 抽屉打开时锁滚动 + Esc 关闭
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLAnchorElement>('a[href]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const navClass = ['nav', float ? 'nav--float' : '', solid ? 'is-solid' : ''].filter(Boolean).join(' ');

  return (
    <>
      <header className={navClass}>
        <div className="nav__in">
          <Link className="brand" href="/" aria-label="集智 AI OPC 社区 首页">
            <img className="brand__mark" src="/opc/reference/img/logo-icon.png" alt="集智 AI OPC 社区" width={40} height={40} />
            <span className="brand__txt">
              <span className="brand__cn">集智 <span style={{ color: '#3D8BFF' }}>AI</span></span>
              <span className="brand__en">JIZHI · AI</span>
            </span>
          </Link>
          <nav aria-label="主导航">
            <ul className="menu" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {navigation.map((item) => {
                const active = navigationMatchesPath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link className={`mlink${active ? ' is-active' : ''}`} href={item.href} aria-current={active ? 'page' : undefined}>
                      {item.label}
                      {!!item.children?.length && CHEVRON}
                    </Link>
                    {!!item.children?.length && (
                      <div className="drop">
                        {item.children.map((child) => (
                          <Link href={child.href} key={child.href}>{child.label}</Link>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
          <Link className="btn btn--primary btn--sm nav__cta" href={apply.href}>{apply.label}</Link>
          <button
            type="button"
            className={`burger${open ? ' on' : ''}`}
            aria-label={open ? '关闭菜单' : '打开菜单'}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <span />
          </button>
        </div>
      </header>

      <div className={`mnav${open ? ' on' : ''}`} ref={drawer} id="mnav">
        {navigation.map((item) => (
          <div key={item.href}>
            <Link href={item.href}>{item.label}</Link>
            {item.children?.map((child) => (
              <Link className="sub" href={child.href} key={child.href}>{child.label}</Link>
            ))}
          </div>
        ))}
        <Link className="btn btn--primary" href={apply.href}>{apply.label}</Link>
      </div>
    </>
  );
}
