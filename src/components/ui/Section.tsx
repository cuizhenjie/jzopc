import clsx from 'clsx';
import type { ReactNode } from 'react';

export function Section({
  children,
  className,
  id,
  tone = 'white',
  size = 'md',
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: 'white' | 'surface' | 'navy';
  size?: 'sm' | 'md' | 'lg';
}) {
  const tones = {
    white: 'bg-white',
    surface: 'bg-[var(--color-surface)]',
    navy: 'bg-[var(--color-brand-navy)] text-white',
  };
  const sizes = {
    sm: 'py-12 sm:py-16',
    md: 'py-16 sm:py-24',
    lg: 'py-20 sm:py-28',
  };
  return (
    <section id={id} className={clsx(tones[tone], sizes[size], className)}>
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">{children}</div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  desc,
  align = 'center',
  dark = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  desc?: ReactNode;
  align?: 'left' | 'center';
  dark?: boolean;
}) {
  return (
    <div
      className={clsx(
        'max-w-3xl',
        align === 'center' ? 'mx-auto text-center' : 'text-left',
        'mb-12 sm:mb-16',
      )}
    >
      {eyebrow && (
        <span
          className={clsx(
            'inline-block rounded-full px-3.5 py-1 text-xs font-medium tracking-wide',
            dark
              ? 'bg-white/10 text-[var(--color-brand-cyan)] ring-1 ring-white/15'
              : 'bg-[var(--color-brand-blue)]/8 text-[var(--color-brand-blue)] ring-1 ring-[var(--color-brand-blue)]/15',
          )}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={clsx(
          'mt-5 text-[26px] leading-[1.25] font-semibold tracking-tight sm:text-[34px]',
          dark ? 'text-white' : 'text-[var(--color-brand-navy)]',
        )}
      >
        {title}
      </h2>
      {desc && (
        <p
          className={clsx(
            'mt-4 text-[15px] leading-relaxed sm:text-base',
            dark ? 'text-white/70' : 'text-[var(--color-ink-2)]',
          )}
        >
          {desc}
        </p>
      )}
    </div>
  );
}
