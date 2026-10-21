import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'light';
type Size = 'sm' | 'md' | 'lg';

/** Consistent 8px corners and quiet color feedback across actions. */
const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  // The deeper logo blue provides readable white button text.
  primary:
    'bg-[var(--color-brand-blue-deep)] text-white hover:bg-[var(--color-brand-navy)]',
  secondary:
    'border border-[var(--color-brand-blue-deep)]/35 text-[var(--color-brand-blue-deep)] hover:border-[var(--color-brand-blue-deep)] hover:bg-[var(--color-brand-blue)]/6',
  ghost:
    'text-[var(--color-ink-2)] hover:text-[var(--color-brand-blue-deep)] hover:bg-[var(--color-brand-blue)]/6',
  // An outline keeps secondary actions legible on the navy surface.
  light: 'bg-transparent text-white border border-white/30 hover:bg-white/10 hover:border-white/60',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-10 px-4 text-sm',
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
