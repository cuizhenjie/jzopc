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

/**
 * 区块标题。
 *
 * ## 两处刻意的调整（消除「AI 感」）
 *
 * 1. **默认左对齐**。过去默认 `align="center"`，全站 12 处区块标题里 9 处是
 *    「居中大标题 + 副标题 + 一排同款卡片」，滚动时节奏完全不变 —— 这是模板站最强的信号。
 *    改成左对齐后，页面读起来像「编排过的内容」而不是「组件拼装」。
 *    需要居中的区块请显式传 `align="center"`。
 * 2. **eyebrow 从胶囊改成纯文字小标**。每个区块顶部挂一颗圆角胶囊 + 描边，
 *    是 AI 生成模板的标志性元素；纯文字小标更克制，也更接近编辑排版。
 */
export function SectionHead({
  eyebrow,
  title,
  desc,
  align = 'left',
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
            'block text-[12px] font-medium tracking-[0.18em]',
            dark ? 'text-[var(--color-brand-cyan)]' : 'text-[var(--color-brand-blue-deep)]',
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
