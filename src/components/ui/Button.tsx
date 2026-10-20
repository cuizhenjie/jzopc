import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import clsx from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'light';
type Size = 'sm' | 'md' | 'lg';

/**
 * 按钮。
 *
 * 圆角从胶囊改为 `rounded-lg`（8px）：胶囊适合「主行动点」，
 * 但全站所有按钮都是胶囊时会失去强调意义；主行动点由 Header 的独立样式承担。
 */
const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  // 主按钮：底色用「浅底可读蓝」（白字 5.87:1），阴影只在主按钮上出现
  primary:
    'bg-[var(--color-brand-blue-deep)] text-white shadow-[var(--shadow-card)] hover:bg-[var(--color-brand-navy)] hover:shadow-[var(--shadow-lift)] hover:-translate-y-0.5',
  secondary:
    'border border-[var(--color-brand-blue-deep)]/35 text-[var(--color-brand-blue-deep)] hover:border-[var(--color-brand-blue-deep)] hover:bg-[var(--color-brand-blue)]/6',
  ghost:
    'text-[var(--color-ink-2)] hover:text-[var(--color-brand-blue-deep)] hover:bg-[var(--color-brand-blue)]/6',
  // 深底上的次级按钮：去掉 backdrop-blur（玻璃拟态是 AI 感来源之一），用实底色代替
  light: 'bg-white/12 text-white border border-white/25 hover:bg-white/20 hover:border-white/40',
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
