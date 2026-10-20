import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'light';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--color-brand-blue)] text-white shadow-[0_8px_24px_-10px_rgba(29,127,186,0.9)] hover:bg-[var(--color-brand-navy)] hover:shadow-[0_12px_30px_-10px_rgba(20,47,89,0.85)] hover:-translate-y-0.5',
  secondary:
    'border border-[var(--color-brand-blue)]/35 text-[var(--color-brand-blue)] hover:border-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/6',
  ghost: 'text-[var(--color-ink-2)] hover:text-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/6',
  light:
    'bg-white/10 text-white border border-white/25 backdrop-blur hover:bg-white/18 hover:border-white/40',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 text-[15px]',
  lg: 'h-[52px] px-8 text-base',
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<'button'>) {
  return (
    <button className={clsx(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  href,
  ...rest
}: CommonProps & { href: string } & Omit<ComponentProps<typeof Link>, 'href' | 'className'>) {
  return (
    <Link href={href} className={clsx(base, variants[variant], sizes[size], className)} {...rest}>
      {children}
    </Link>
  );
}
