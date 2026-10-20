'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { nav, contentReady, type NavItem } from '@/lib/site/config';
import BrandMark from '@/components/ui/BrandMark';

/**
 * 过滤掉「内容尚未就绪」的子项（PRD FR-ABOUT-05）。
 *
 * 「发展历程 / 服务对象」目前只有内容占位（G6 / G7），按需求应当在导航里
 * **隐藏**而不是点进去看到空页。是否就绪由 `config.ts` 的 `contentReady`
 * 数据表决定 —— 业务补齐内容后把对应值改成 `true`，导航自动出现，Header 无需再改。
 */
function visibleChildren(item: NavItem) {
  return (item.children ?? []).filter((c) => contentReady[c.href] !== false);
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    // 不设 aria-label：可见文字为「集智 AI / JIZHI · AI」，
    // 若用 aria-label 覆盖会违反 WCAG 2.5.3（可访问名须包含可见文字）。
    // 「首页」用 sr-only 追加，名称即变为「…首页」，仍包含全部可见文字。
    <Link href="/" className="flex items-center gap-2.5">
      {/* 品牌徽记取自 logo.svg（浅底版 / 深底反白版），详见 components/ui/BrandMark */}
      <BrandMark light={light} />
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
            'mt-0.5 text-[11px] tracking-[0.18em]',
            light ? 'text-white/55' : 'text-[var(--color-ink-3)]',
          )}
        >
          JIZHI · AI
        </span>
      </span>
      <span className="sr-only">首页</span>
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
  const navText = navOnDark ? 'text-white/85 hover:text-white' : 'text-[var(--color-ink-2)] hover:text-[var(--color-brand-blue-deep)]';
  const navTextActive = navOnDark ? 'text-white' : 'text-[var(--color-brand-blue-deep)]';

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
                {visibleChildren(item).length > 0 && (
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

              {visibleChildren(item).length > 0 && (
                <div className="invisible absolute left-0 top-full w-52 translate-y-1 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="rounded-xl border border-[var(--color-line)] bg-white p-1.5 shadow-[var(--shadow-overlay)]">
                    {visibleChildren(item).map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={clsx(
                          'block rounded-lg px-3 py-2 text-[13px] transition-colors',
                          isActive(c.href)
                            ? 'bg-[var(--color-brand-blue)]/8 text-[var(--color-brand-blue-deep)]'
                            : 'text-[var(--color-ink-2)] hover:bg-[var(--color-surface)] hover:text-[var(--color-brand-blue-deep)]',
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
            className="hidden h-10 items-center rounded-full bg-[var(--color-brand-blue-deep)] px-6 text-sm font-medium text-white shadow-[0_8px_24px_-10px_rgba(29,127,186,.9)] transition-all hover:-translate-y-0.5 hover:bg-[var(--color-brand-navy)] lg:inline-flex"
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
            <div key={item.label} className="border-b border-[var(--color-line)] py-1 last:border-0">
              <Link
                href={item.href}
                className={clsx(
                  // 触控区：min-h-[40px] 让移动端抽屉导航项的可点击高度 ≥ 40px
                  // （原先仅 24px，低于 Apple HIG 建议的 44pt 与主流 32–40px 实践）
                  'flex min-h-[40px] items-center text-[16px] font-medium',
                  isActive(item.href) ? 'text-[var(--color-brand-blue-deep)]' : 'text-[var(--color-brand-navy)]',
                )}
              >
                {item.label}
              </Link>
              {visibleChildren(item).length > 0 && (
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 pb-2">
                  {visibleChildren(item).map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      className="flex min-h-[40px] items-center rounded-md px-2 text-[13px] text-[var(--color-ink-2)]"
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
            className="mt-6 flex h-12 items-center justify-center rounded-full bg-[var(--color-brand-blue-deep)] text-[15px] font-medium text-white"
          >
            申请入驻
          </Link>
        </nav>
      </div>
    </header>
  );
}
