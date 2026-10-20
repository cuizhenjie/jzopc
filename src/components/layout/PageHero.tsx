import Link from 'next/link';
import type { ReactNode } from 'react';

export type Crumb = { label: string; href?: string };

export default function PageHero({
  eyebrow,
  title,
  desc,
  crumbs = [],
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  desc?: ReactNode;
  crumbs?: Crumb[];
  children?: ReactNode;
}) {
  return (
    <section
      data-nav-theme="dark"
      className="relative overflow-hidden bg-[var(--color-brand-navy)] pt-[104px] pb-14 sm:pt-[128px] sm:pb-20"
    >
      {/* 轻量网格 + 光晕，静态，不依赖 WebGL */}
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(26,168,211,.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(26,168,211,.10) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        <div
          className="absolute -right-24 -top-24 h-[420px] w-[420px] rounded-full blur-[110px]"
          style={{ background: 'radial-gradient(circle, rgba(26,168,211,.30), transparent 68%)' }}
        />
        <div
          className="absolute -bottom-32 -left-20 h-[360px] w-[360px] rounded-full blur-[110px]"
          style={{ background: 'radial-gradient(circle, rgba(87,182,165,.22), transparent 68%)' }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-[1240px] px-5 sm:px-8">
        {crumbs.length > 0 && (
          <nav aria-label="面包屑" className="mb-5 flex flex-wrap items-center gap-1.5 text-[12px]">
            {crumbs.map((c, i) => (
              <span key={c.label} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-white/30">/</span>}
                {c.href ? (
                  <Link
                    href={c.href}
                    // 面包屑链接原本 18px 高，加内边距让触控高度达 24px（WCAG 2.5.8 AA）
                    className="inline-block py-1 text-white/55 transition-colors hover:text-white"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-white/85">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}

        {eyebrow && (
          // 纯文字小标（去掉胶囊底色与描边）：内页 Hero 的 eyebrow 不再是「徽章」，
          // 深底上用亮青，对比度 4.79:1 合规
          <span className="inline-block text-[12px] font-medium tracking-[0.18em] text-[var(--color-brand-cyan)]">
            {eyebrow}
          </span>
        )}

        <h1 className="mt-5 max-w-3xl text-[30px] font-semibold leading-[1.2] tracking-tight text-white sm:text-[42px]">
          {title}
        </h1>

        {desc && (
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/70 sm:text-[16px]">
            {desc}
          </p>
        )}

        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
