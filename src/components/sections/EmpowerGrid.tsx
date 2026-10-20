'use client';

import Link from 'next/link';
import { empowerModules } from '@/lib/site/config';
import { Stagger } from '@/components/ui/Reveal';

/**
 * 八大赋能卡片区。
 *
 * 与 `EmpowerChain` 联动：hover 某张卡片时，上方链路里的对应节点点亮
 * （见 docs/06 §4.1 D-02 修订记录）。
 */
export default function EmpowerGrid({
  active = null,
  onHover,
}: {
  active?: string | null;
  onHover?: (slug: string | null) => void;
}) {
  return (
    <div id="empower">
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {empowerModules.map((m) => {
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
                  'group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-brand-blue-deep)]/30 hover:shadow-[var(--shadow-lift)] ' +
                  (on
                    ? 'border-[var(--color-brand-blue-deep)]/45 shadow-[var(--shadow-lift)]'
                    : 'border-[var(--color-line)]')
                }
              >
                {/* hover 时从左下角升起的品牌色光晕 */}
                <span
                  className="pointer-events-none absolute -bottom-16 -left-16 h-36 w-36 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: 'radial-gradient(circle, rgba(9,104,171,.22), transparent 70%)' }}
                />
                <span className="relative font-mono text-[13px] font-semibold tracking-widest text-[var(--color-brand-blue-deep)]">
                  {m.index}
                </span>
                <h3 className="relative mt-3 text-[17px] font-semibold text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue-deep)]">
                  {m.title}
                </h3>
                <p className="relative mt-2.5 flex-1 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                  {m.tagline}
                </p>
                <span className="relative mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-brand-blue-deep)]">
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
