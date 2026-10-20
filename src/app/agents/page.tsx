import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { EmptyState, Badge } from '@/components/ui/Card';
import { Reveal } from '@/components/ui/Reveal';
import FilterRoot from '@/components/ui/FilterRoot';
import FilterLink from '@/components/ui/FilterLink';
import { getAgentCategories, getAgents } from '@/lib/queries';
import { agentHero } from '@/lib/site/config';

export const metadata: Metadata = {
  title: '智能体',
  description: agentHero.subtitle,
  alternates: { canonical: '/agents' },
};

export const revalidate = 300;

/**
 * 目录里的「主卡」数量：前 6 个作为精选位（带卡片阴影、较大圆角），
 * 其余退为次级卡（只描边、无阴影），避免 29 张卡同款的「AI 生成感」。
 */
const PRIMARY_CARD_COUNT = 6;

export default async function AgentsPage() {
  const [all, categories] = await Promise.all([getAgents(), getAgentCategories()]);

  return (
    <>
      <PageHero
        eyebrow="智能体市场"
        title={agentHero.title}
        desc={agentHero.subtitle}
        crumbs={[{ label: '首页', href: '/' }, { label: '智能体' }]}
      />

      <Section size="sm">
        {/* 分类与搜索：服务端渲染全部条目，客户端按 URL 参数过滤
            （页面保持静态，title/description 才会落在 <head> 内） */}
        <FilterRoot param="category">
          <Reveal>
            <div className="flex flex-col gap-5 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
              <div className="flex flex-wrap gap-2">
                <FilterLink
                  href="/agents"
                  param="category"
                  value=""
                  className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)] transition-colors hover:text-[var(--color-brand-blue-deep)]"
                >
                  全部
                </FilterLink>
                {categories.map((c) => (
                  <FilterLink
                    key={c.slug}
                    href={`/agents?category=${c.slug}`}
                    param="category"
                    value={c.slug}
                    className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)] transition-colors hover:text-[var(--color-brand-blue-deep)]"
                  >
                    {c.name}
                  </FilterLink>
                ))}
              </div>

              <form action="/agents" className="flex gap-2">
                <input type="hidden" name="category" value="" data-filter-sync-input="category" />
                <input
                  type="search"
                  name="q"
                  defaultValue={''}
                  placeholder="搜索智能体名称、能力或标签"
                  className="h-10 w-full max-w-sm rounded-lg border border-[var(--color-line)] bg-white px-3.5 text-[14px] outline-none focus:border-[var(--color-brand-blue-deep)]"
                />
                <button
                  type="submit"
                  className="h-10 shrink-0 rounded-lg bg-[var(--color-brand-navy)] px-5 text-[14px] font-medium text-white transition-colors hover:bg-[var(--color-brand-blue-deep)]"
                >
                  搜索
                </button>
              </form>
            </div>
          </Reveal>

          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[20px] font-semibold text-[var(--color-brand-navy)]">智能体目录</h2>
            <p className="text-[13px] text-[var(--color-ink-3)]">
              共 <span data-filter-count>{all.length}</span> 个智能体
            </p>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {all.map((a, i) => {
              const isPrimary = i < PRIMARY_CARD_COUNT;
              return (
                <Reveal key={a.slug} delay={Math.min(i, 8) * 0.04}>
                  <Link
                    href={`/agents/${a.slug}`}
                    data-filter-key={a.category}
                    data-filter-text={`${a.name} ${a.summary} ${a.tags.join(' ')}`}
                    className={
                      isPrimary
                        ? 'group flex h-full flex-col rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-brand-blue-deep)]/30 hover:shadow-[var(--shadow-lift)]'
                        : 'group flex h-full flex-col rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-none transition-colors duration-200 hover:border-[var(--color-brand-blue-deep)]/40 hover:bg-[var(--color-surface)]'
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--color-brand-blue)]/10 text-[15px] font-semibold text-[var(--color-brand-blue-deep)]">
                        {a.name.slice(0, 1)}
                      </span>
                      <Badge tone="outline" className="text-[12px]">
                        {categories.find((c) => c.slug === a.category)?.name ?? a.category}
                      </Badge>
                    </div>
                    <h3 className="mt-4 text-[16px] font-semibold text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue-deep)]">
                      {a.name}
                    </h3>
                    <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                      {a.summary}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {a.tags.slice(0, 3).map((t) => (
                        <span key={t} className="rounded bg-[var(--color-surface)] px-2 py-0.5 text-[12px] text-[var(--color-ink-3)]">
                          {t}
                        </span>
                      ))}
                    </div>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-brand-blue-deep)]">
                      查看详情
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" fill="none" aria-hidden="true">
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>

          <div className="mt-10" data-filter-empty style={{ display: 'none' }}>
            <EmptyState
              title="该条件下暂无智能体"
              desc="智能体目录正在持续扩充。可以换个分类或关键词看看，也可以直接联系我们推荐你需要的能力。"
            />
          </div>
        </FilterRoot>

        <p className="mt-10 text-center text-[12px] text-[var(--color-ink-3)]">
          当前展示为示例目录，正式智能体清单将按社区采集结果持续更新。
        </p>
      </Section>
    </>
  );
}
