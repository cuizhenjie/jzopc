import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, SectionHead } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { Reveal, Stagger } from '@/components/ui/Reveal';
import { Badge } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { academy } from '@/lib/site/config';
import { getCourses } from '@/lib/queries';

export const metadata: Metadata = {
  title: '集智商学院',
  description: `${academy.slogan}。${academy.summary}`,
  alternates: { canonical: '/academy' },
};

export const revalidate = 600;

export default async function AcademyPage() {
  const courses = await getCourses();

  return (
    <>
      <PageHero
        eyebrow="集智商学院"
        title={<>学AI技能拿高薪Offer<br />让未来，从这里开始</>}
        desc={academy.summary}
        crumbs={[{ label: '首页', href: '/' }, { label: '集智商学院' }]}
      >
        <div className="flex flex-wrap gap-2">
          {academy.tags.map((t) => (
            <span
              key={t}
              className="page-hero-tag rounded px-4 py-1.5 text-[13px] font-medium"
            >
              {t}
            </span>
          ))}
        </div>
      </PageHero>

      {/* 培训课程体系 */}
      <Section>
        <SectionHead
          eyebrow="培训课程体系"
          title="紧跟行业需求，打造系统化 AI 人才培养体系"
          desc="五条课程线，对应五类真实岗位方向。"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {academy.tracks.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.05}>
              <div className="group h-full rounded-xl border border-[var(--color-line)] bg-white p-6 shadow-none transition-colors duration-200 hover:border-[var(--color-brand-blue-deep)]/40 hover:bg-[var(--color-surface)]">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[19px] font-semibold text-[var(--color-brand-navy)]">
                    {t.name}
                  </h3>
                  <Badge tone="blue" className="text-[12px]">{t.tag}</Badge>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-2)]">{t.desc}</p>
                <div className="mt-5 text-[13px] font-medium text-[var(--color-brand-blue-deep)]">
                  {courses.filter((c) => c.track === t.name).length} 门课程在售 →
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 一站式就业服务 */}
      <Section tone="surface">
        <SectionHead
          eyebrow="一站式就业服务"
          title="从学习到就业，全程陪伴"
          desc="从学习到就业，全程陪伴，让每一次努力都有结果"
        />
        {/* 就业服务是「测评 → 培训 → 实战 → 求职 → 推荐 → 跟踪」的线性流程，
            用竖向时间线呈现，不做成六张同款卡片 */}
        <ol className="mt-2">
          {academy.steps.map((s, i) => (
            <li
              key={s.step}
              className="border-l-2 border-[var(--color-brand-blue)]/25 py-6 pl-5 first:pt-3 last:pb-3"
            >
              <Reveal delay={Math.min(i, 6) * 0.05}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[12px] font-semibold tracking-widest text-[var(--color-ink-3)]">
                    STEP
                  </span>
                  <span className="font-mono text-[24px] font-semibold leading-none text-[var(--color-brand-blue-deep)]">
                    {s.step}
                  </span>
                  <h3 className="text-[16px] font-semibold text-[var(--color-brand-navy)]">
                    {s.title}
                  </h3>
                </div>
                <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-center gap-1.5 text-[13px] text-[var(--color-ink-2)]">
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
                        <path
                          d="M3 8.5 6.2 11.5 13 4.5"
                          stroke="var(--color-brand-teal)"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {p}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </li>
          ))}
        </ol>
      </Section>

      {/* 课程列表 */}
      {courses.length > 0 && (
        <Section size="sm">
          <SectionHead eyebrow="在售课程" title="可报名课程" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c, i) => (
              <Reveal key={c.slug} delay={Math.min(i, 6) * 0.05}>
                <Link
                  href={`/academy/courses/${c.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[var(--shadow-lift)]"
                >
                  <Badge tone="outline" className="text-[12px]">{c.track}</Badge>
                  <h3 className="mt-3.5 text-[16px] font-semibold leading-snug text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue-deep)]">
                    {c.title}
                  </h3>
                  <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                    {c.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {c.tags.map((t) => (
                      <span key={t} className="rounded bg-[var(--color-surface)] px-2 py-0.5 text-[12px] text-[var(--color-ink-3)]">
                        {t}
                      </span>
                    ))}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* CTA */}
      <Section tone="navy" size="sm">
        <div className="text-center">
          <h2 className="text-[26px] font-semibold text-white sm:text-[32px]">想知道自己适合哪条路线？</h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] text-white/70">
            先做职业测评，再决定学什么。留下联系方式，社区会安排你完成测评并给出学习路径建议。
          </p>
          <div className="mt-8 flex justify-center">
            <ButtonLink
              href="/apply"
              size="lg"
              className="!bg-white !text-[var(--color-brand-navy)] hover:!bg-[var(--color-brand-teal)] hover:!text-white"
            >
              预约测评
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}
