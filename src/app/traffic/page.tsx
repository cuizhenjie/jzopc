import type { Metadata } from 'next';
import { Section } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import LeadForm from '@/components/forms/LeadForm';
import Placeholder from '@/components/ui/Placeholder';
import { Reveal } from '@/components/ui/Reveal';

export const metadata: Metadata = {
  title: '流量超市',
  description: 'AIGC 内容产能就在社区里，让产品先被看见，再谈成交。',
  alternates: { canonical: '/traffic' },
};

export const revalidate = 3600;

const values = [
  {
    title: '产能在场',
    desc: 'AIGC 内容生产团队已经入驻社区。需求可以直接对接人，不用走采购与招标流程。',
  },
  {
    title: '先被看见',
    desc: '产品上线前的素材、视觉、投放与内容测试，社区能提供就近的支持。',
  },
  {
    title: '从流量到成交',
    desc: '流量不是终点。内容跑出来的数据会反哺产品，最终还是要回到订单和收入。',
  },
];

export default function TrafficPage() {
  return (
    <>
      <PageHero
        eyebrow="流量超市"
        title="让产品先被看见，再谈成交"
        desc="依托已入驻社区的 AIGC 流量生产基地，把内容产能放在创业者触手可及的地方。"
        crumbs={[{ label: '首页', href: '/' }, { label: '流量超市' }]}
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <h2 className="text-[22px] font-semibold text-[var(--color-brand-navy)]">
              社区里的流量生产
            </h2>
            <p className="mt-4 text-[15px] leading-[1.9] text-[var(--color-ink-2)]">
              很多 OPC 团队能把产品做出来，却没有把产品讲明白的能力。流量赋能解决的就是这一环——内容生产就在楼里，从第一张图到第一批投放，不用跨城、跨公司、跨流程。
            </p>

            <div className="mt-9 space-y-5">
              {values.map((v, i) => (
                <Reveal key={v.title} delay={i * 0.07}>
                  <div className="flex gap-4">
                    <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-blue)]/10 font-mono text-[13px] font-semibold text-[var(--color-brand-blue-deep)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="text-[16px] font-semibold text-[var(--color-brand-navy)]">
                        {v.title}
                      </h3>
                      <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
                        {v.desc}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <div>
            <LeadForm
              leadType="traffic"
              sourcePage="/traffic"
              title="申请流量支持"
              desc="告诉我们你的产品与当前阶段，社区会安排对接。"
              compact
            />
          </div>
        </div>
      </Section>

      <Section tone="surface" size="sm">
        <Placeholder
          title="集智AIGC新媒体流量基地介绍与赋能机制"
          desc="该基地的完整介绍、赋能机制与实训项目清单正在整理中。内容完成后会补充到本页，并同步到首页的八大赋能卡片。"
        />
      </Section>
    </>
  );
}
