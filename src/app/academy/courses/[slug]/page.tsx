import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Section } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import JsonLd from '@/components/ui/JsonLd';
import { site } from '@/lib/site/config';
import LeadForm from '@/components/forms/LeadForm';
import { Badge } from '@/components/ui/Card';
import { getCourse, getCourses } from '@/lib/queries';

export const revalidate = 600;

export function generateStaticParams() {
  return getCourses().then((list) => list.map((c) => ({ slug: c.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCourse(slug);
  if (!c) return { title: '课程' };
  return {
    title: c.title,
    description: c.summary,
    alternates: { canonical: `/academy/courses/${c.slug}` },
  };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await getCourse(slug);
  if (!course) notFound();

  const courseJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.summary,
    inLanguage: 'zh-CN',
    // 导师用 schema.org 的 instructor（原先误用 courseWorkload —— 那是 ISO-8601 时长字段）
    instructor: course.mentor ? { '@type': 'Person', name: course.mentor } : undefined,
    provider: { '@type': 'Organization', name: site.company, url: site.url },
    url: `${site.url}/academy/courses/${course.slug}`,
    hasCourseInstance: {
      '@type': 'CourseInstance',
      // 与页面可见文案一致（「线下授课 + 项目制实战」），不能写成 online
      courseMode: 'onsite',
    },
  };

  return (
    <>
      <JsonLd data={courseJsonLd} />
      <PageHero
        eyebrow={course.track}
        title={course.title}
        desc={course.summary}
        crumbs={[
          { label: '首页', href: '/' },
          { label: '集智商学院', href: '/academy' },
          { label: course.title },
        ]}
      />

      <Section size="sm">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <div>
            <h2 className="text-[20px] font-semibold text-[var(--color-brand-navy)]">课程介绍</h2>
            <p className="mt-4 text-[15px] leading-[1.9] text-[var(--color-ink-2)]">{course.summary}</p>
            {/* 课程大纲（DB 列 body jsonb，运营填写后显示；本期种子为空则不渲染） */}
            {course.body && course.body.length > 0 && (
              <div className="mt-4 space-y-3">
                {course.body.map((p, i) => (
                  <p key={i} className="text-[15px] leading-[1.9] text-[var(--color-ink-2)]">
                    {p}
                  </p>
                ))}
              </div>
            )}

            <h3 className="mt-9 text-[15px] font-semibold text-[var(--color-brand-navy)]">适合人群</h3>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {course.tags.map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[13px] text-[var(--color-ink-2)]">
                  <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
                    <path
                      d="M3 8.5 6.2 11.5 13 4.5"
                      stroke="var(--color-brand-teal)"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {t}
                </li>
              ))}
            </ul>

            <div className="mt-9 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-card)]">
              <h3 className="text-[15px] font-semibold text-[var(--color-brand-navy)]">授课与认证</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                线下授课 + 项目制实战，社区内企业会提供真实项目作为练习素材。完成课程后可进入就业推荐环节，认证与研学班另行申请。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="blue" className="text-[12px]">实战教学</Badge>
                <Badge tone="teal" className="text-[12px]">AIGC认证</Badge>
                <Badge tone="outline" className="text-[12px]">就业推荐</Badge>
              </div>
            </div>
          </div>

          <aside>
            <LeadForm
              leadType="course"
              sourcePage={`/academy/courses/${course.slug}`}
              sourceRef={course.slug}
              title="课程报名咨询"
              desc={`报名「${course.title}」，社区会与你确认班期`}
              compact
            />
          </aside>
        </div>
      </Section>
    </>
  );
}
