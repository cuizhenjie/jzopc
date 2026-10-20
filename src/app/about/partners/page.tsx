import type { Metadata } from 'next';
import { Section, SectionHead } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { Reveal } from '@/components/ui/Reveal';
import LeadForm from '@/components/forms/LeadForm';
import { getPartners } from '@/lib/queries';

export const metadata: Metadata = {
  title: '生态伙伴',
  description: '集智 AI OPC 社区的生态伙伴与合作网络。',
  alternates: { canonical: '/about/partners' },
};

export const revalidate = 3600;

export default async function PartnersPage() {
  const partners = await getPartners();

  return (
    <>
      <PageHero
        eyebrow="关于集智"
        title="生态伙伴"
        desc="八大赋能不是孤立的功能，而是接在真实的产业网络里。"
        crumbs={[{ label: '首页', href: '/' }, { label: '关于集智', href: '/about' }, { label: '生态伙伴' }]}
      />

      <Section>
        <SectionHead
          eyebrow="合作企业"
          title="与众多知名企业达成深度合作"
          desc="合作方名单以实际授权为准，持续更新中。若你的企业希望成为社区生态伙伴，欢迎联系我们。"
        />
        <Reveal>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {partners.map((name) => (
              <li
                key={name}
                className="flex h-[76px] items-center justify-center rounded-xl border border-[var(--color-line)] bg-white px-4 text-center text-[14px] font-medium text-[var(--color-ink-2)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/30 hover:text-[var(--color-brand-blue)]"
              >
                {name}
              </li>
            ))}
          </ul>
        </Reveal>
      </Section>

      <Section tone="surface" size="sm">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-[22px] font-semibold text-[var(--color-brand-navy)]">成为生态伙伴</h2>
            <p className="mt-4 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
              社区面向算力供给、企服、流量与资本四类生态角色开放合作。提交合作意向后，社区团队会与你对接具体的合作形式、资源投入与收益方式。
            </p>
            <ul className="mt-6 space-y-3 text-[14px] text-[var(--color-ink-2)]">
              {[
                '算力供给方：把闲置算力接进社区的聚合平台',
                '专业服务商：把人事、财税、法务与知产服务打包进社区',
                '流量与内容方：把 AIGC 产能接在社区里，帮产品先被看见',
                '投资机构：对接有真实交付能力的 AI 团队',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-brand-cyan)]" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <LeadForm leadType="contact" sourcePage="/about/partners" title="提交合作意向" compact />
        </div>
      </Section>
    </>
  );
}
