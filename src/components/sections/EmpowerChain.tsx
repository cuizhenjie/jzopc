import { empowerModules } from '@/lib/site/config';
import { Reveal } from '@/components/ui/Reveal';

/**
 * 八大赋能链路。
 *
 * 依据竞品审查结论（docs/05 §6.2）：所有头部社区的叙事都是「空间+算力+课程+活动」
 * 四个并列块；集智唯一的差异化是**八大赋能是一条链**，不是八个功能。
 * 这条链路把「顺序」显性化：从空间起步 → 算力 → 智能体 → 订单 → 流量 → 资本。
 */
const chainOrder = [
  { key: 'space', label: '空间起步' },
  { key: 'compute', label: '算力' },
  { key: 'agents', label: '智能体' },
  { key: 'market', label: '订单' },
  { key: 'traffic', label: '流量' },
  { key: 'capital', label: '资本' },
];

export default function EmpowerChain() {
  return (
    <Reveal className="mb-10">
      <div className="relative rounded-2xl border border-[var(--color-line)] bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-8">
          <div className="lg:w-56 lg:shrink-0">
            <p className="text-[12px] font-medium tracking-wide text-[var(--color-brand-cyan)]">
              八大赋能 · 一条链
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
              不是八个并列的功能，是一条从工位走到订单的路径。
            </p>
          </div>

          <ol className="relative flex flex-1 flex-wrap items-center gap-x-2 gap-y-3">
            {/* 链路流光底线 */}
            <span
              className="pointer-events-none absolute left-0 right-0 top-[11px] hidden h-px lg:block"
              aria-hidden="true"
              style={{
                background:
                  'linear-gradient(90deg, rgba(29,127,186,.15) 0%, rgba(29,127,186,.55) 18%, rgba(26,168,211,.9) 50%, rgba(87,182,165,.55) 82%, rgba(87,182,165,.15) 100%)',
              }}
            />
            {chainOrder.map((c, i) => (
              <li key={c.key} className="relative flex items-center gap-2">
                <span
                  className="relative z-10 grid h-[22px] w-[22px] place-items-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-[0_0_0_1px_rgba(29,127,186,.25)]"
                  style={{ background: 'linear-gradient(135deg,#0968AB,#57B6A5)' }}
                >
                  {i + 1}
                </span>
                <span className="text-[13px] font-medium text-[var(--color-brand-navy)]">{c.label}</span>
                {i < chainOrder.length - 1 && (
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand-blue)]/45"
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
            ))}
          </ol>
        </div>

        <p className="mt-6 border-t border-[var(--color-line)] pt-5 text-[13px] leading-relaxed text-[var(--color-ink-3)]">
          八大赋能覆盖 {empowerModules.length} 个模块，完整清单见下方。社区内企业拿到的不是八张服务清单，而是一条能走通的创业路径。
        </p>
      </div>
    </Reveal>
  );
}
