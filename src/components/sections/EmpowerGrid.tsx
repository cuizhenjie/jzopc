'use client';

import Link from 'next/link';
import { empowerModules } from '@/lib/site/config';
import { chainModules } from '@/lib/site/chain';
import { Stagger } from '@/components/ui/Reveal';

/**
 * 八大赋能的**链路模块**卡片。
 *
 * 只展示构成创业路径的 6 个模块（空间 → 算力 → 智能体 → 订单 → 流量 → 资本），
 * 学院与企服超市作为「贯穿全链的支撑能力」在 `EmpowerChain` 的支撑条里呈现。
 *
 * 6 张卡走 3 列网格（而非 8 张卡挤 4 列）：一是消除「八个并列功能」的视觉自相矛盾，
 * 二是让每张主卡有足够呼吸空间。
 */
export default function EmpowerGrid({
  active = null,
  onHover,
}: {
  active?: string | null;
  onHover?: (slug: string | null) => void;
}) {
  const modules = chainModules
    .map((c) => empowerModules.find((m) => m.slug === c.slug))
    .filter((m): m is (typeof empowerModules)[number] => Boolean(m));

  return (
    <div id="empower">
      <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m, i) => {
          const on = active === m.slug;
          return (
            <div
              key={m.slug}
              onMouseEnter={() => onHover?.(m.slug)}
              onMouseLeave={() => onHover?.(null)}
              onFocus={() => onHover?.(m.slug)}
              onBlur={() => onHover?.(null)}
            >
              <Link
                href={m.href}
                aria-current={on ? 'true' : undefined}
                className={
                  // 主卡：16px 圆角 + 阴影 + 抬升 hover（每屏 ≤4 个）
                  'group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white p-7 transition-all duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] ' +
                  (on
                    ? 'border-[var(--color-brand-blue-deep)]/40 shadow-[var(--shadow-card)]'
                    : 'border-[var(--color-line)] shadow-[var(--shadow-card)]')
                }
              >
                {/* hover 时从左下角升起的品牌色光晕 */}
                <span
                  className="pointer-events-none absolute -bottom-16 -left-16 h-36 w-36 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: 'radial-gradient(circle, rgba(9,104,171,.22), transparent 70%)' }}
                />
                {/* 编号用**链路序号**（01–06），与上方链路组件的节点一一对应。
                    若沿用八大赋能的原始编号，会出现 01→03→02→06 的跳号，读起来是错的。 */}
                <span className="relative font-mono text-[13px] font-semibold tracking-widest text-[var(--color-brand-blue-deep)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="relative mt-3 text-[18px] font-semibold text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue-deep)]">
                  {m.title}
                </h3>
                <p className="relative mt-2.5 flex-1 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                  {m.tagline}
                </p>
                <span className="relative mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-brand-blue-deep)]">
                  了解详情
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 8h10M9 4l4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </Link>
            </div>
          );
        })}
      </Stagger>
    </div>
  );
}
