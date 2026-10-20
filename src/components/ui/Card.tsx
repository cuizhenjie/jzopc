import clsx from 'clsx';
import type { ReactNode } from 'react';

/**
 * 卡片。
 *
 * ## 两档制（消除「AI 感」的关键）
 *
 * 过去全站只有一种卡片：`rounded-2xl` + `border` + `shadow-card`，再配 `hover:-translate-y-1`。
 * 结果是**每一张卡都会「抬起来」**，层级失真，看上去像模板生成的通用官网。
 *
 * 现在分两档：
 *
 * | 变体 | 外观 | 用途 |
 * |---|---|---|
 * | `default`（次级卡） | `rounded-xl` + 1px 描边 + **无阴影** | 列表条目、支撑模块、次级面板 |
 * | `feature`（主卡） | `rounded-2xl` + 描边 + `shadow-card` | 每屏 ≤4 个的主卡 / 主转化面 |
 *
 * hover 行为也随之分级：次级卡只改边框与底色（安静），主卡才抬升换阴影。
 *
 * 详见 `docs/06-视觉方案与3D动效规范.md` §2.4。
 */
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
  /** `feature` = 主卡（带阴影）；`default` = 次级卡（描边、无阴影） */
  variant?: 'default' | 'feature';
  as?: 'div' | 'article' | 'li';
}) {
  const isFeature = variant === 'feature';
  return (
    <Tag
      className={clsx(
        'border border-[var(--color-line)] bg-white',
        isFeature
          ? 'rounded-2xl shadow-[var(--shadow-card)]'
          : 'rounded-xl shadow-none',
        hover &&
          (isFeature
            ? 'transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-1 hover:border-[var(--color-brand-blue-deep)]/30 hover:shadow-[var(--shadow-lift)]'
            : 'transition-colors duration-200 hover:border-[var(--color-brand-blue-deep)]/40 hover:bg-[var(--color-surface)]'),
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
    <div className="rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-8 py-16 text-center">
      <div className="mx-auto mb-5 h-14 w-14 rounded-xl bg-[var(--color-brand-blue)]/8 ring-1 ring-[var(--color-brand-blue)]/15">
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
