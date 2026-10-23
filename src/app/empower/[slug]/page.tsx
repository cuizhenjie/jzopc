import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Section, SectionHead } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import LeadForm from '@/components/forms/LeadForm';
import Placeholder from '@/components/ui/Placeholder';
import { Reveal, Stagger } from '@/components/ui/Reveal';
import { ButtonLink } from '@/components/ui/Button';
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

      {/* 价值点 */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div>
            <SectionHead
              align="left"
              eyebrow="核心价值"
              title={`${m.title}能解决什么`}
            />
            <div>
              <Stagger className="grid gap-4 sm:grid-cols-2">
                {m.values.map((v) => (
                  <Reveal key={v.title} y={0}>
                    <div className="h-full rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-none transition-colors hover:border-[var(--color-brand-blue)]/30">
                      <h3 className="text-[16px] font-semibold text-[var(--color-brand-navy)]">
                        {v.title}
                      </h3>
                      <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                        {v.desc}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </Stagger>
            </div>
          </div>

          <div>
            {m.highlights && m.highlights.length > 0 && (
              <Reveal>
                <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-card)]">
                  <h3 className="text-[16px] font-semibold text-[var(--color-brand-navy)]">关键数据</h3>
                  <dl className="mt-5 space-y-4">
                    {m.highlights.map((h) => (
                      <div
                        key={h.label}
                        className="flex items-baseline justify-between border-b border-[var(--color-line)] pb-3.5 last:border-0 last:pb-0"
                      >
                        <dt className="text-[13px] text-[var(--color-ink-2)]">{h.label}</dt>
                        <dd className="text-[15px] font-semibold text-[var(--color-brand-navy)]">
                          {h.value}
                        </dd>
                      </div>
                    ))}
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

      {/* 留资 / 缺口 */}
      <Section tone="surface" size="sm">
        {m.leadType ? (
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className="text-[22px] font-semibold text-[var(--color-brand-navy)]">
                申请{m.title}支持
              </h2>
              <p className="mt-4 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
                留下联系方式，社区团队会先了解你的项目阶段与实际需求，再给出可执行的支持方案——不推销、不群发，需求不匹配会直接说明。
              </p>
              {m.pending && (
                <div className="mt-6 rounded-xl border border-[var(--color-brand-blue)]/20 bg-[var(--color-brand-blue)]/[0.04] px-4 py-3.5 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                  <span className="font-medium text-[var(--color-brand-blue-deep)]">内容说明：</span>
                  {m.pending}
                </div>
              )}
            </div>
            <LeadForm
              leadType={m.leadType}
              sourcePage={`/empower/${m.slug}`}
              title={`${m.title} · 咨询与申请`}
              desc="我们会在一个工作日内与你联系。"
              compact
            />
          </div>
        ) : m.pending ? (
          <Placeholder title="内容筹备中" desc={m.pending} />
        ) : (
          <div className="grid gap-8 text-center sm:grid-cols-2">
            <Reveal>
              <div className="rounded-xl border border-[var(--color-line)] bg-white p-6">
                <h3 className="text-[18px] font-semibold text-[var(--color-brand-navy)]">
                  去{m.title}专区
                </h3>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                  {m.tagline}
                </p>
                <div className="mt-6">
                  <ButtonLink
                    href={
                      m.slug === 'agents'
                        ? '/agent'
                        : m.slug === 'academy'
                          ? '/center'
                          : m.slug === 'market'
                            ? '/market'
                            : '/apply'
                    }
                  >
                    {m.slug === 'agents'
                      ? '浏览智能体'
                      : m.slug === 'academy'
                        ? '进入学院'
                        : m.slug === 'market'
                          ? '进入供需市场'
                          : '申请入驻'}
                  </ButtonLink>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="rounded-xl border border-[var(--color-line)] bg-white p-6">
                <h3 className="text-[18px] font-semibold text-[var(--color-brand-navy)]">
                  还有疑问？
                </h3>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                  留下联系方式，社区团队会直接回答你的问题。
                </p>
                <div className="mt-6">
                  <ButtonLink href="/apply" variant="secondary">
                    联系我们
                  </ButtonLink>
                </div>
              </div>
            </Reveal>
          </div>
        )}
      </Section>

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
