import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Section } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { Badge } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { getAgent, getAgentCategories, getAgents } from '@/lib/queries';

export const revalidate = 300;

export function generateStaticParams() {
  return getAgents().then((list) => list.map((a) => ({ slug: a.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const agent = await getAgent(slug);
  if (!agent) return { title: '智能体' };
  return {
    title: agent.name,
    description: agent.summary,
    alternates: { canonical: `/agents/${agent.slug}` },
  };
}

export default async function AgentDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = await getAgent(slug);
  if (!agent) notFound();
  const categories = await getAgentCategories();
  const catName = categories.find((c) => c.slug === agent.category)?.name ?? agent.category;

  return (
    <>
      <PageHero
        eyebrow={catName}
        title={agent.name}
        desc={agent.summary}
        crumbs={[
          { label: '首页', href: '/' },
          { label: '智能体', href: '/agent' },
          { label: agent.name },
        ]}
      >
        <a
          href={agent.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-[52px] items-center gap-2 rounded-lg bg-white px-8 text-base font-medium text-[var(--color-brand-navy)] shadow-[0_14px_36px_-14px_rgba(0,0,0,.55)] transition-all hover:-translate-y-0.5 hover:bg-[var(--color-brand-teal)] hover:text-white"
        >
          立即使用
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M6 3h7v7M13 3 4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </PageHero>

      <Section size="sm">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <div>
            <h2 className="text-[20px] font-semibold text-[var(--color-brand-navy)]">能力说明</h2>
            <p className="mt-4 text-[15px] leading-[1.9] text-[var(--color-ink-2)]">{agent.description}</p>

            <h3 className="mt-10 text-[16px] font-semibold text-[var(--color-brand-navy)]">能力标签</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {agent.tags.map((t) => (
                <Badge key={t} tone="blue" className="text-[12px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-card)]">
              <h3 className="text-[15px] font-semibold text-[var(--color-brand-navy)]">基本信息</h3>
              <dl className="mt-4 space-y-3.5 text-[13px]">
                <div className="flex justify-between gap-4 border-b border-[var(--color-line)] pb-3.5">
                  <dt className="text-[var(--color-ink-3)]">分类</dt>
                  <dd className="font-medium text-[var(--color-ink)]">{catName}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-[var(--color-line)] pb-3.5">
                  <dt className="text-[var(--color-ink-3)]">提供方</dt>
                  <dd className="font-medium text-[var(--color-ink)]">{agent.provider}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--color-ink-3)]">使用方式</dt>
                  <dd className="font-medium text-[var(--color-ink)]">外部平台</dd>
                </div>
              </dl>
              <a
                href={agent.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-blue-deep)] text-[15px] font-medium text-white transition-colors hover:bg-[var(--color-brand-navy)]"
              >
                前往 {agent.name}
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
                  <path d="M6 3h7v7M13 3 4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <p className="mt-3 text-center text-[12px] leading-relaxed text-[var(--color-ink-3)]">
                链接指向第三方平台，在新标签页打开。社区不参与其账号与数据。
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-none">
              <h3 className="text-[15px] font-semibold text-[var(--color-brand-navy)]">需要别的能力？</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                告诉我们你的场景，社区帮你对接合适的智能体与服务方。
              </p>
              <div className="mt-5">
                <ButtonLink href="/apply" variant="secondary" size="sm">
                  提交需求
                </ButtonLink>
              </div>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
