import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

/**
 * 内容缺口的占位区块。
 * 规则见 docs/01-需求文档.md §6.3：结构先行、内容后补；
 * 不允许留空白区块，也不允许用占位文案冒充真实内容。
 */
export default function Placeholder({
  title,
  desc,
  hint = '内容筹备中',
  children,
}: {
  title: string;
  desc: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-[var(--color-brand-blue)]/25 bg-[var(--color-surface)] px-7 py-14 sm:px-12 sm:py-20">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(50% 60% at 12% 0%, rgba(29,127,186,.10), transparent 60%), radial-gradient(45% 55% at 92% 100%, rgba(87,182,165,.12), transparent 62%)',
        }}
      />
      <div className="relative mx-auto max-w-2xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-blue)]/8 px-3.5 py-1 text-xs font-medium text-[var(--color-brand-blue-deep)] ring-1 ring-[var(--color-brand-blue)]/15">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-cyan)]" />
          {hint}
        </span>
        <h2 className="mt-5 text-[22px] font-semibold text-[var(--color-brand-navy)] sm:text-[26px]">
          {title}
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-2)]">{desc}</p>
        {children && <div className="mt-8">{children}</div>}
      </div>
    </div>
  );
}

export function FactCard({
  items,
}: {
  items: { label: string; value: string; note?: string }[];
}) {
  return (
    <Card className="p-6" hover={false}>
      <dl className="space-y-4">
        {items.map((i) => (
          <div key={i.label} className="border-b border-[var(--color-line)] pb-3.5 last:border-0 last:pb-0">
            <dt className="text-[12px] text-[var(--color-ink-3)]">{i.label}</dt>
            <dd className="mt-1 text-[15px] font-medium text-[var(--color-ink)]">{i.value}</dd>
            {i.note && <p className="mt-1 text-[12px] text-[var(--color-ink-3)]">{i.note}</p>}
          </div>
        ))}
      </dl>
    </Card>
  );
}
