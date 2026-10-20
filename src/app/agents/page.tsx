import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { EmptyState, Badge } from '@/components/ui/Card';
import { Reveal } from '@/components/ui/Reveal';
import { getAgentCategories, getAgents } from '@/lib/queries';
import { agentHero } from '@/lib/site/config';

export const metadata: Metadata = {
  title: '智能体',
  description: agentHero.subtitle,
  alternates: { canonical: '/agents' },
};

export const revalidate = 600;

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const [all, categories] = await Promise.all([getAgents(), getAgentCategories()]);
  const list = all
    .filter((a) => (category ? a.category === category : true))
    .filter((a) =>
      q
        ? a.name.toLowerCase().includes(q.toLowerCase()) ||
          a.summary.toLowerCase().includes(q.toLowerCase()) ||
          a.tags.some((t) => t.toLowerCase().includes(q.toLowerCase()))
        : true,
    );

  const activeCat = categories.find((c) => c.slug === category);

  return (
    <>
      <PageHero
        eyebrow="智能体市场"
        title={agentHero.title}
        desc={agentHero.subtitle}
        crumbs={[{ label: '首页', href: '/' }, { label: '智能体' }]}
      />

      <Section size="sm">
        {/* 筛选 */}
        <Reveal>
          <div className="flex flex-col gap-5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
            <form action="/agents" className="flex flex-wrap gap-2">
              <Link
                href="/agents"
                className={
                  !category
                    ? 'rounded-full bg-[var(--color-brand-blue)] px-4 py-2 text-[13px] font-medium text-white'
                    : 'rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)] transition-colors hover:text-[var(--color-brand-blue)]'
                }
              >
                全部
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/agents?category=${c.slug}`}
                  className={
                    category === c.slug
                      ? 'rounded-full bg-[var(--color-brand-blue)] px-4 py-2 text-[13px] font-medium text-white'
                      : 'rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)] transition-colors hover:text-[var(--color-brand-blue)]'
                  }
                >
                  {c.name}
                </Link>
              ))}
            </form>

            <form action="/agents" className="flex gap-2">
              {category && <input type="hidden" name="category" value={category} />}
              <input
                type="search"
                name="q"
                defaultValue={q ?? ''}
                placeholder="搜索智能体名称、能力或标签"
                className="h-10 w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-white px-3.5 text-[14px] outline-none focus:border-[var(--color-brand-blue)]"
              />
              <button
                type="submit"
                className="h-10 shrink-0 rounded-lg bg-[var(--color-brand-navy)] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[var(--color-brand-blue)]"
              >
                搜索
              </button>
            </form>
          </div>
        </Reveal>

        {activeCat && (
          <p className="mt-6 text-[13px] text-[var(--color-ink-3)]">
            当前分类：<span className="font-medium text-[var(--color-brand-blue)]">{activeCat.name}</span>
            ，共 {list.length} 个智能体
          </p>
        )}

        {list.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              title="该条件下暂无智能体"
              desc="智能体目录正在持续扩充。可以换个分类或关键词看看，也可以直接联系我们推荐你需要的能力。"
            />
          </div>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((a, i) => (
              <Reveal key={a.slug} delay={Math.min(i, 8) * 0.04}>
                <Link
                  href={`/agents/${a.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-[var(--color-line)] bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[var(--shadow-lift)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-brand-blue)]/10 text-[15px] font-semibold text-[var(--color-brand-blue)]">
                      {a.name.slice(0, 1)}
                    </span>
                    <Badge tone="outline">
                      {categories.find((c) => c.slug === a.category)?.name ?? a.category}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-[16px] font-semibold text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue)]">
                    {a.name}
                  </h3>
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                    {a.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {a.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-ink-3)]">
                        {t}
                      </span>
                    ))}
                  </div>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-brand-blue)]">
                    查看详情
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" fill="none" aria-hidden="true">
                      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-[12px] text-[var(--color-ink-3)]">
          当前展示为示例目录，正式智能体清单将按社区采集结果持续更新。
        </p>
      </Section>
    </>
  );
}
