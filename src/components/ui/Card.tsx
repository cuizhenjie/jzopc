import clsx from 'clsx';
import type { ReactNode } from 'react';

/** Shared content panels use a light outline; emphasis comes from typography and placement. */
export function Card({
  children,
  className,
  hover = true,
  variant = 'default',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  /** Feature panels receive a brand-colored top edge. */
  variant?: 'default' | 'feature';
  as?: 'div' | 'article' | 'li';
}) {
  const isFeature = variant === 'feature';
  return (
    <Tag
      className={clsx(
        'rounded-xl border border-[var(--color-line)] bg-white shadow-none',
        isFeature && 'border-t-2 border-t-[var(--color-brand-blue-deep)]',
        hover && 'transition-colors duration-200 hover:border-[var(--color-brand-blue-deep)]/40 hover:bg-[var(--color-surface)]',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Badge({
  children,
  tone = 'blue',
  className,
}: {
  children: ReactNode;
  tone?: 'blue' | 'teal' | 'navy' | 'outline';
  className?: string;
}) {
  const tones = {
    blue: 'bg-[var(--color-brand-blue)]/8 text-[var(--color-brand-blue-deep)]',
    teal: 'bg-[var(--color-brand-teal)]/12 text-[var(--color-brand-navy-3)]',
    navy: 'bg-[var(--color-brand-navy)] text-white',
    outline: 'border border-[var(--color-line)] text-[var(--color-ink-2)]',
  };
  return (
    <span
      className={clsx(
        // 12px 而非 11px：中文在 11px 下高 DPI 屏会发糊
        'inline-flex items-center rounded-md px-2 py-0.5 text-[12px] font-medium leading-5',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
