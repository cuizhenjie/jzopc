import type { Metadata } from 'next';
import { Section } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import LeadForm from '@/components/forms/LeadForm';
import { Reveal } from '@/components/ui/Reveal';

export const metadata: Metadata = {
  title: '申请入驻',
  description:
    '申请入驻集智 AI OPC 空间。加入集智 AI OPC 产业社区，获取办公空间、全套 AI 智能体能力与八大创业赋能资源。',
  alternates: { canonical: '/apply' },
};

export const dynamic = 'force-static';

const process = [
  { step: '01', title: '提交意向', desc: '填写下方表单，说明你的项目方向与当前需求。' },
  { step: '02', title: '社区对接', desc: '社区团队在一个工作日内联系你，了解更具体的情况。' },
  { step: '03', title: '看空间与定方案', desc: '实地看房，确认工位类型、配套与赋能方案。' },
  { step: '04', title: '入驻启动', desc: '签约入驻、工商财税法务一站式对接，开始办公。' },
];

export default function ApplyPage() {
  return (
    <>
      <PageHero
        eyebrow="申请入驻"
        title="申请入驻集智 AI OPC 空间"
        desc="加入集智 AI OPC 产业社区，获取办公空间、全套 AI 智能体能力与八大创业赋能资源，链接 AI 产业伙伴，加速项目落地。填写意向表单，我们将尽快与您对接沟通。"
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <div>
            <h2 className="text-[22px] font-semibold text-[var(--color-brand-navy)]">入驻流程</h2>
            <ol className="mt-7 space-y-6">
              {process.map((p, i) => (
                // li 必须是 ol 的直接子元素，Reveal 包裹层放在 li 内部
                <li key={p.step}>
                  <Reveal delay={i * 0.06}>
                    <div className="flex gap-4">
                      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--color-brand-blue)]/10 font-mono text-[13px] font-semibold text-[var(--color-brand-blue-deep)]">
                        {p.step}
                      </span>
                      <div>
                        <h3 className="text-[16px] font-semibold text-[var(--color-brand-navy)]">
                          {p.title}
                        </h3>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                          {p.desc}
                        </p>
                      </div>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>

            <Reveal delay={0.2}>
              <div className="mt-9 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6">
                <h3 className="text-[15px] font-semibold text-[var(--color-brand-navy)]">入驻须知</h3>
                <ul className="mt-4 space-y-2.5 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                  <li>· 社区面向 AI 创业团队、微型团队与「一人公司」，团队规模原则上不超过 10 人。</li>
                  <li>· 入驻需签署入驻协议，并承诺遵守社区的场地与安全管理规定。</li>
                  <li>· 涉及政策补贴的申请，以主管部门与社区的实际审核结果为准。</li>
                  <li>· 提交表单即表示同意社区使用你留下的信息进行本次对接。</li>
                </ul>
              </div>
            </Reveal>
          </div>

          <div>
            <LeadForm
              leadType="apply"
              sourcePage="/apply"
              withApplyFields
              title="填写入驻意向表"
              desc="带 * 为必填项。提交后社区团队会尽快与您对接沟通。"
            />
          </div>
        </div>
      </Section>
    </>
  );
}
