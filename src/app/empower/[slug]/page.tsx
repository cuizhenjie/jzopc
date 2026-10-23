import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Section, SectionHead } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { Reveal } from '@/components/ui/Reveal';
import EmpowerFx from '@/components/anim/EmpowerFx';
import { empowerDetails, getEmpowerDetail } from '@/lib/data/empower';
import { empowerModules } from '@/lib/site/config';

export const revalidate = 3600;

export function generateStaticParams() {
  return empowerDetails.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const m = getEmpowerDetail(slug);
  if (!m) return { title: '赋能模块' };
  return {
    title: m.title,
    description: m.tagline,
    alternates: { canonical: `/empower/${m.slug}` },
  };
}

/**
 * 把「3000+ ㎡」这类指标拆成纯数字 + 单位后缀，供 count-up 使用
 * （data-count-value 只放数字，单位/后缀静态渲染、不参与滚动）。
 * 非数字开头的值（如「丰台 · 大红门」）返回 null，按普通文本渲染。
 */
function splitStatValue(value: string): { num: string; suffix: string } | null {
  const m = value.match(/^(\d[\d,.]*)(.*)$/);
  return m ? { num: m[1], suffix: m[2] } : null;
}

export default async function EmpowerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const m = getEmpowerDetail(slug);
  if (!m) notFound();

  const related = empowerModules.filter((x) => m.related.includes(x.slug));

  return (
    <>
      <PageHero
        eyebrow={`八大赋能 · ${m.index}`}
        title={m.title}
        desc={m.heroDesc}
        crumbs={[
          { label: '首页', href: '/' },
          { label: '八大赋能', href: '/empower/space' },
          { label: m.title },
        ]}
      >
        <p className="page-hero-note">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brand-cyan)]" />
          {m.tagline}
        </p>
      </PageHero>

      {/* 价值点（入场 stagger 与数字滚动由 EmpowerFx 驱动） */}
      <EmpowerFx>
        <Section>
          <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
            <div>
              <SectionHead
                align="left"
                eyebrow="核心价值"
                title={`${m.title}能解决什么`}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                {m.values.map((v, i) => (
                  <div
                    key={v.title}
                    className="empower-value-card relative h-full rounded-xl border border-[var(--color-line)] bg-white p-5 pt-6 transition-all duration-300 ease-out hover:-translate-y-[3px] hover:border-[var(--color-brand-blue)]/50 hover:shadow-[var(--shadow-lift)]"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-5 top-0 h-[2px] w-10 rounded-full bg-[linear-gradient(90deg,var(--color-brand-blue),var(--color-brand-cyan))]"
                    />
                    <span className="font-mono text-[12px] font-semibold tracking-widest text-[var(--color-brand-blue)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h3 className="mt-1.5 text-[16px] font-semibold text-[var(--color-brand-navy)]">
                      {v.title}
                    </h3>
                    <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                      {v.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              {m.highlights && m.highlights.length > 0 && (
                <Reveal>
                  <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-card)]">
                    <h3 className="text-[16px] font-semibold text-[var(--color-brand-navy)]">关键数据</h3>
                    <dl className="mt-5 grid grid-cols-2 gap-3">
                      {m.highlights.map((h) => {
                        const stat = splitStatValue(h.value);
                        return (
                          <div
                            key={h.label}
                            className="rounded-xl border border-[var(--color-line)] bg-white px-4 py-4"
                          >
                            <dt className="text-[13px] text-[var(--color-ink-2)]">{h.label}</dt>
                            <dd
                              className={
                                stat
                                  ? 'tnum mt-2 text-[24px] font-bold leading-[1.15] text-[var(--color-brand-blue)]'
                                  : 'mt-2 text-[17px] font-semibold leading-[1.4] text-[var(--color-brand-blue)]'
                              }
                            >
                              {stat ? (
                                <>
                                  <span data-count-value={stat.num}>{stat.num}</span>
                                  {stat.suffix && (
                                    <span className="ml-0.5 text-[15px] font-semibold">
                                      {stat.suffix}
                                    </span>
                                  )}
                                </>
                              ) : (
                                h.value
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                </Reveal>
              )}

              <Reveal delay={0.1} className="mt-6">
                <div className="rounded-2xl border border-[var(--color-line)] bg-white p-7 shadow-[var(--shadow-card)]">
                  <h3 className="text-[16px] font-semibold text-[var(--color-brand-navy)]">包含能力</h3>
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {m.items.map((i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[13px] text-[var(--color-ink-2)]">
                        <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
                          <path
                            d="M3 8.5 6.2 11.5 13 4.5"
                            stroke="var(--color-brand-teal)"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        {i}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </Section>
      </EmpowerFx>

      {/* 相关赋能 */}
      <Section size="sm">
        <SectionHead eyebrow="相关赋能" title="其他赋能模块" />
        <div className="grid gap-3 sm:grid-cols-3">
          {related.map((r) => (
            <Link
              key={r.slug}
              href={r.href}
              className="group rounded-xl border border-[var(--color-line)] bg-white p-5 transition-colors hover:border-[var(--color-brand-blue)]/30"
            >
              <span className="font-mono text-[12px] font-semibold tracking-widest text-[var(--color-brand-blue-deep)]">
                {r.index}
              </span>
              <h3 className="mt-2.5 text-[15px] font-semibold text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue-deep)]">
                {r.title}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">{r.tagline}</p>
            </Link>
          ))}
        </div>
      </Section>
    </>
  );
}
