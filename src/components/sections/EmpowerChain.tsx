'use client';

import { empowerModules } from '@/lib/site/config';
import { Reveal } from '@/components/ui/Reveal';

/**
 * 八大赋能链路。
 *
 * 依据竞品审查结论（docs/05 §6.2）：所有头部社区的叙事都是「空间+算力+课程+活动」
 * 四个并列块；集智唯一的差异化是**八大赋能是一条链**，不是八个功能。
 * 这条链路把「顺序」显性化：从空间起步 → 算力 → 智能体 → 订单 → 流量 → 资本。
 *
 * D-02 动效（docs/06 §4.1）的落地形态：**hover 赋能卡片 → 对应链路节点点亮**。
 * 原方案是独立的 Paper PulsingBorder/DotOrbit 环状能量环，改为链路节点高亮，
 * 原因是环状结构与「一条链」的定位叙事冲突（见 docs/06 §4.1 修订记录）。
 */
const chainOrder = [
  { key: 'space', label: '空间起步', module: 'space' },
  { key: 'compute', label: '算力', module: 'compute' },
  { key: 'agents', label: '智能体', module: 'agents' },
  { key: 'market', label: '订单', module: 'market' },
  { key: 'traffic', label: '流量', module: 'traffic' },
  { key: 'capital', label: '资本', module: 'capital' },
];

/** 贯穿全链、不占独立节点的支撑能力（人才补齐 + 后台支撑） */
const supportModules = ['academy', 'enterprise'];

export default function EmpowerChain({ active = null }: { active?: string | null }) {
  const supportActive = active !== null && supportModules.includes(active);

  return (
    <Reveal className="mb-10">
      <div className="relative rounded-2xl border border-[var(--color-line)] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8">
          <div className="lg:w-56 lg:shrink-0">
            <p className="text-[12px] font-medium tracking-wide text-[var(--color-brand-blue-deep)]">
              八大赋能 · 一条链
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
              不是八个并列的功能，是一条从工位走到订单的路径。
            </p>
          </div>

          {/* lg:w-fit 让底线宽度跟随节点内容（flex-1 的 flex-basis:0 会覆盖 w-fit，故不与 flex-1 同用） */}
          <ol className="relative flex flex-wrap items-center gap-x-2 gap-y-3 lg:w-fit lg:flex-nowrap">
            {/* 链路流光底线：宽度跟随节点内容，正好收在最后一个节点 */}
            <span
              className="pointer-events-none absolute left-0 right-0 top-[11px] hidden h-px lg:block"
              aria-hidden="true"
              style={{
                background:
                  'linear-gradient(90deg, rgba(9,104,171,.15) 0%, rgba(9,104,171,.55) 18%, rgba(26,168,211,.9) 50%, rgba(87,182,165,.55) 82%, rgba(87,182,165,.15) 100%)',
              }}
            />
            {chainOrder.map((c, i) => {
              const on = active === c.module;
              return (
                <li key={c.key} className="relative flex items-center gap-2">
                  <span
                    className={
                      'relative z-10 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-white text-[10px] font-semibold text-white transition-all duration-300 ' +
                      (on
                        ? 'scale-110 shadow-[0_0_0_3px_rgba(9,104,171,.28),0_0_14px_rgba(26,168,211,.75)]'
                        : 'shadow-[0_0_0_1px_rgba(9,104,171,.25)]')
                    }
                    style={{
                      background: on
                        ? 'linear-gradient(135deg,#0968AB,#0E3769)'
                        : 'linear-gradient(135deg,#0968AB,#0E3769)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={
                      'text-[13px] font-medium transition-colors duration-300 ' +
                      (on ? 'text-[var(--color-brand-blue-deep)]' : 'text-[var(--color-brand-navy)]')
                    }
                  >
                    {c.label}
                  </span>
                  {i < chainOrder.length - 1 && (
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand-blue-deep)]/45"
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
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {/* 贯穿全链的支撑能力：学院补人才、企服补后台，不占独立节点 */}
        <div
          className={
            'mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3 transition-colors duration-300 ' +
            (supportActive
              ? 'border-[var(--color-brand-blue-deep)]/35 bg-[var(--color-brand-blue-deep)]/[0.06]'
              : 'border-[var(--color-line)] bg-[var(--color-surface)]')
          }
        >
          <span className="text-[12px] font-medium text-[var(--color-ink-2)]">贯穿全链</span>
          {supportModules.map((slug) => {
            const m = empowerModules.find((x) => x.slug === slug);
            if (!m) return null;
            const on = active === slug;
            return (
              <span
                key={slug}
                className={
                  'rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors duration-300 ' +
                  (on
                    ? 'bg-[var(--color-brand-blue-deep)] text-white'
                    : 'bg-white text-[var(--color-brand-navy)] ring-1 ring-[var(--color-line)]')
                }
              >
                {m.title}
              </span>
            );
          })}
          <span className="text-[12px] text-[var(--color-ink-3)]">人才补齐 + 后台支撑</span>
        </div>

        <p className="mt-5 border-t border-[var(--color-line)] pt-5 text-[13px] leading-relaxed text-[var(--color-ink-3)]">
          八大赋能覆盖 {empowerModules.length} 个模块，完整清单见下方。社区内企业拿到的不是八张服务清单，而是一条能走通的创业路径。
        </p>
      </div>
    </Reveal>
  );
}
