import clsx from 'clsx';
import type { ReactNode } from 'react';

export function Card({
  children,
  className,
  hover = true,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  as?: 'div' | 'article' | 'li';
}) {
  return (
    <Tag
      className={clsx(
        'rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-card)]',
        hover &&
          'transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-1 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[var(--shadow-lift)]',
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
    blue: 'bg-[var(--color-brand-blue)]/8 text-[var(--color-brand-blue)]',
    teal: 'bg-[var(--color-brand-teal)]/12 text-[#3d8578]',
    navy: 'bg-[var(--color-brand-navy)] text-white',
    outline: 'border border-[var(--color-line)] text-[var(--color-ink-2)]',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium leading-5',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-8 py-16 text-center">
      <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-[var(--color-brand-blue)]/8 ring-1 ring-[var(--color-brand-blue)]/15">
        <svg viewBox="0 0 24 24" className="h-full w-full p-3" fill="none" aria-hidden="true">
          <path
            d="M12 3v18M3 12h18"
            stroke="var(--color-brand-blue)"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.5"
          />
        </svg>
      </div>
      <p className="text-base font-medium text-[var(--color-brand-navy)]">{title}</p>
      {desc && <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-ink-3)]">{desc}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
