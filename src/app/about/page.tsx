import type { Metadata } from 'next';
import { Section, SectionHead } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { Reveal } from '@/components/ui/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { intros, site } from '@/lib/site/config';
import { getPartners } from '@/lib/queries';

export const metadata: Metadata = {
  title: '集智简介',
  description: intros.v1,
  alternates: { canonical: '/about' },
};

export const revalidate = 3600;

const facts = [
  { label: '运营主体', value: site.company },
  { label: '所在地', value: site.address },
  { label: '首期规模', value: site.area },
  { label: '启动运营', value: site.launch },
];

export default async function AboutPage() {
  const partners = await getPartners();

  return (
    <>
      <PageHero
        eyebrow="关于集智"
        title={<>一站式 AI 应用<br />综合赋能平台</>}
        desc={intros.v1}
        crumbs={[{ label: '首页', href: '/' }, { label: '关于集智' }]}
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          <div>
            <Reveal>
              <h2 className="text-[24px] font-semibold text-[var(--color-brand-navy)] sm:text-[28px]">
                我们在做什么
              </h2>
            </Reveal>
            <div className="mt-6 space-y-5">
              {intros.v3.map((p, i) => (
                <Reveal key={i} delay={i * 0.06}>
                  <p className="text-[15px] leading-[1.9] text-[var(--color-ink-2)]">{p}</p>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={0.12}>
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-card)]">
              <h3 className="text-[16px] font-semibold text-[var(--color-brand-navy)]">关键事实</h3>
              <dl className="mt-5 space-y-4">
                {facts.map((f) => (
                  <div key={f.label} className="border-b border-[var(--color-line)] pb-4 last:border-0 last:pb-0">
                    <dt className="text-[12px] text-[var(--color-ink-3)]">{f.label}</dt>
                    <dd className="mt-1 text-[15px] font-medium text-[var(--color-ink)]">{f.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6">
                <ButtonLink href="/apply" size="sm">
                  申请入驻
                </ButtonLink>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section tone="surface" size="sm">
        <SectionHead
          eyebrow="生态伙伴"
          title="与生态伙伴共建 AI 产业生态"
          desc="社区的八大赋能不是孤立的功能，而是接在真实的产业网络里。"
        />
        <Reveal>
          {/* 生态伙伴用单线网格呈现，不做成卡片墙 */}
          <ul className="grid grid-cols-2 border-t border-[var(--color-line)] sm:grid-cols-4 lg:grid-cols-8">
            {partners.map((name) => (
              <li
                key={name}
                className="flex h-[64px] items-center justify-center border-b border-[var(--color-line)] px-3 text-center text-[13px] font-medium text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-brand-blue-deep)]"
              >
                {name}
              </li>
            ))}
          </ul>
        </Reveal>
      </Section>
    </>
  );
}
