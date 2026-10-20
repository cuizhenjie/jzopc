import type { Metadata } from 'next';
import { Section } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import Placeholder from '@/components/ui/Placeholder';
import LeadForm from '@/components/forms/LeadForm';

export const metadata: Metadata = {
  title: '发展历程',
  description: '集智 AI OPC 社区的发展历程与关键节点。',
  alternates: { canonical: '/about/history' },
};

export const revalidate = 3600;

export default function HistoryPage() {
  return (
    <>
      <PageHero
        eyebrow="关于集智"
        title="发展历程"
        desc="集智 AI OPC 社区由北京集美科技有限公司打造，2026 年 10 月正式启动运营。"
        crumbs={[{ label: '首页', href: '/' }, { label: '关于集智', href: '/about' }, { label: '发展历程' }]}
      />

      <Section>
        <Placeholder
          title="时间轴内容筹备中"
          desc="社区的阶段性节点正在整理中。我们不会用占位内容冒充真实历程——正式时间轴会在这里完整呈现。如需了解当前进展，可先留下联系方式，由社区团队直接对接。"
        >
          <div className="mx-auto max-w-xl">
            <LeadForm
              leadType="contact"
              sourcePage="/about/history"
              title="获取发展历程信息"
              desc="留下联系方式，社区团队会向你同步最新进展。"
              compact
            />
          </div>
        </Placeholder>
      </Section>
    </>
  );
}
