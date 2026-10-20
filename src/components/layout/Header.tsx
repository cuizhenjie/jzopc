'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { nav } from '@/lib/site/config';

function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="集智 AI OPC 社区 首页">
      <span
        className={clsx(
          'grid h-9 w-9 place-items-center rounded-[10px] text-[13px] font-bold tracking-tight',
          light ? 'bg-white/12 text-white ring-1 ring-white/25' : 'text-white',
        )}
        style={{ background: light ? undefined : 'linear-gradient(135deg,#0968AB,#57B6A5)' }}
      >
        集智
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={clsx(
            'text-[15px] font-semibold tracking-tight',
            light ? 'text-white' : 'text-[var(--color-brand-navy)]',
          )}
        >
          集智 AI
        </span>
        <span
          className={clsx(
            'mt-0.5 text-[10px] tracking-[0.18em]',
            light ? 'text-white/55' : 'text-[var(--color-ink-3)]',
          )}
        >
          JIZHI · AI
        </span>
      </span>
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  /** 页面顶部是否为深色底 —— 决定未滚动时导航用浅色还是深色字 */
  const [darkTop, setDarkTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const els = document.querySelectorAll('[data-nav-theme]');
    if (els.length === 0) {
      setDarkTop(false);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setDarkTop(e.target.getAttribute('data-nav-theme') === 'dark');
          }
        }
      },
      // 导航栏以下 72px 处的水平切面
      { rootMargin: '-72px 0px -95% 0px', threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  // 未滚动且顶部为深底 → 导航用浅色字；其余情况用深色字
  const navOnDark = !scrolled && darkTop;
  const navText = navOnDark ? 'text-white/85 hover:text-white' : 'text-[var(--color-ink-2)] hover:text-[var(--color-brand-blue)]';
  const navTextActive = navOnDark ? 'text-white' : 'text-[var(--color-brand-blue)]';

  return (
    <header
      className={clsx(
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-white/85 backdrop-blur-xl shadow-[0_1px_0_rgba(20,47,89,.08)]'
          : 'bg-transparent',
      )}
    >
      <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between px-5 sm:px-8">
        <Logo light={navOnDark} />

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="主导航">
          {nav.map((item) => (
            <div key={item.label} className="group relative">
              <Link
                href={item.href}
                className={clsx(
                  'flex items-center gap-1 rounded-lg px-3.5 py-2 text-[14px] font-medium transition-colors',
                  isActive(item.href) ? navTextActive : navText,
                )}
              >
                {item.label}
                {item.children && (
                  <svg
                    viewBox="0 0 12 12"
                    className="h-2.5 w-2.5 transition-transform group-hover:rotate-180"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                )}
              </Link>

              {item.children && (
                <div className="invisible absolute left-0 top-full w-52 translate-y-1 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="rounded-xl border border-[var(--color-line)] bg-white p-1.5 shadow-[var(--shadow-lift)]">
                    {item.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={clsx(
                          'block rounded-lg px-3 py-2 text-[13px] transition-colors',
                          isActive(c.href)
                            ? 'bg-[var(--color-brand-blue)]/8 text-[var(--color-brand-blue)]'
                            : 'text-[var(--color-ink-2)] hover:bg-[var(--color-surface)] hover:text-[var(--color-brand-blue)]',
                        )}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/apply"
            className="hidden h-10 items-center rounded-full bg-[var(--color-brand-blue)] px-6 text-sm font-medium text-white shadow-[0_8px_24px_-10px_rgba(29,127,186,.9)] transition-all hover:-translate-y-0.5 hover:bg-[var(--color-brand-navy)] lg:inline-flex"
          >
            申请入驻
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={clsx(
              'grid h-10 w-10 place-items-center rounded-lg ring-1 lg:hidden',
              navOnDark ? 'text-white ring-white/25' : 'text-[var(--color-brand-navy)] ring-[var(--color-line)]',
            )}
            aria-label={open ? '关闭菜单' : '打开菜单'}
            aria-expanded={open}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* 移动端抽屉 */}
      <div
        className={clsx(
          'fixed inset-x-0 top-[72px] bottom-0 z-40 overflow-y-auto bg-white transition-all duration-300 lg:hidden',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
      >
        <nav className="px-5 py-6" aria-label="移动端导航">
          {nav.map((item) => (
            <div key={item.label} className="border-b border-[var(--color-line)] py-3 last:border-0">
              <Link
                href={item.href}
                className={clsx(
                  'block text-[16px] font-medium',
                  isActive(item.href) ? 'text-[var(--color-brand-blue)]' : 'text-[var(--color-brand-navy)]',
                )}
              >
                {item.label}
              </Link>
              {item.children && (
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  {item.children.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      className="rounded-md px-2 py-1.5 text-[13px] text-[var(--color-ink-2)]"
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link
            href="/apply"
            className="mt-6 flex h-12 items-center justify-center rounded-full bg-[var(--color-brand-blue)] text-[15px] font-medium text-white"
          >
            申请入驻
          </Link>
        </nav>
      </div>
    </header>
  );
}
