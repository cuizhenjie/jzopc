import type { Metadata } from 'next';
import { Section, SectionHead } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import Placeholder from '@/components/ui/Placeholder';
import LeadForm from '@/components/forms/LeadForm';
import { Reveal, Stagger } from '@/components/ui/Reveal';

export const metadata: Metadata = {
  title: '服务对象',
  description: '集智 AI OPC 社区服务谁：AI 创业者、一人公司、服务商与生态伙伴。',
  alternates: { canonical: '/about/audience' },
};

export const revalidate = 3600;

const audiences = [
  {
    title: 'AI 创业者 / 一人公司',
    desc: '一个人也能是一家公司。社区把场地、算力、订单与服务提前铺好，你只管把产品做好。',
    tags: ['空间', '算力', '订单'],
  },
  {
    title: '服务商与生态伙伴',
    desc: '专业服务能力在这里被看见。企服、流量、资本与产业资源方可以通过社区直接触达真实需求方。',
    tags: ['曝光', '撮合', '长期合作'],
  },
  {
    title: '入驻学员',
    desc: '从技能到就业的一条完整路径：课程、AIGC 认证、研学班与就业推荐，线上线下一体。',
    tags: ['课程', '认证', '就业推荐'],
  },
  {
    title: '投资机构与产业方',
    desc: '在社区里直接看到可落地的 AI 项目与团队，用真实交付能力而不是 PPT 做判断。',
    tags: ['项目', '场景', '订单'],
  },
];

export default function AudiencePage() {
  return (
    <>
      <PageHero
        eyebrow="关于集智"
        title="服务对象"
        desc="社区不是只服务一种人，而是让需求方与供给方在同一个物理空间里相遇。"
        crumbs={[{ label: '首页', href: '/' }, { label: '关于集智', href: '/about' }, { label: '服务对象' }]}
      />

      <Section>
        <SectionHead
          align="left"
          eyebrow="谁适合来"
          title="四类核心人群"
          desc="以下为社区服务的核心人群类型，正式的服务对象画像正在补充中。"
        />
        <div>
          <Stagger className="grid gap-4 sm:grid-cols-2">
            {audiences.map((a) => (
              <Reveal key={a.title} y={0}>
                <div className="h-full rounded-2xl border border-[var(--color-line)] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                  <h3 className="text-[17px] font-semibold text-[var(--color-brand-navy)]">{a.title}</h3>
                  <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-2)]">{a.desc}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {a.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-md bg-[var(--color-brand-blue)]/8 px-2 py-0.5 text-[11px] font-medium text-[var(--color-brand-blue-deep)]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </Stagger>
        </div>
      </Section>

      <Section tone="surface" size="sm">
        <Placeholder
          title="完整画像筹备中"
          desc="更细致的服务对象描述、典型案例与入驻路径正在整理。留下联系方式，我们会把最贴近你情况的路径讲清楚。"
        >
          <div className="mx-auto max-w-xl">
            <LeadForm
              leadType="contact"
              sourcePage="/about/audience"
              title="获取适合你的入驻路径"
              compact
            />
          </div>
        </Placeholder>
      </Section>
    </>
  );
}
