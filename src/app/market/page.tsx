import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, SectionHead } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { Badge, EmptyState } from '@/components/ui/Card';
import { Reveal } from '@/components/ui/Reveal';
import FilterRoot from '@/components/ui/FilterRoot';
import FilterLink from '@/components/ui/FilterLink';
import SearchField from '@/components/ui/SearchField';
import { ButtonLink } from '@/components/ui/Button';
import { getMarketItems } from '@/lib/queries';
import { marketHero } from '@/lib/data/seed';
import { marketSteps } from '@/lib/site/config';
import { searchItemText } from '@/lib/search/matcher';
import { marketToSearchItem } from '@/lib/search/items';

export const metadata: Metadata = {
  title: '供需市场',
  description: marketHero.subtitle,
  alternates: { canonical: '/market' },
};

export const revalidate = 600;

/**
 * 列表里的「主卡」数量：前 2 条作为精选位（带卡片阴影、较大圆角），
 * 其余退为次级卡（只描边、无阴影），让 8 条供需条目有主次之分。
 */
const PRIMARY_CARD_COUNT = 2;

export default async function MarketPage() {
  const all = await getMarketItems();

  return (
    <>
      <PageHero
        eyebrow="供需市场"
        title={marketHero.title}
        desc={marketHero.subtitle}
        crumbs={[{ label: '首页', href: '/' }, { label: '供需市场' }]}
      >
        <ButtonLink href="/apply" variant="light" size="md">
          提交你的需求
        </ButtonLink>
      </PageHero>

      {/* 4 步说明 */}
      <Section size="sm">
        <SectionHead eyebrow="怎么用" title="四步达成合作" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {marketSteps.map((s, i) => (
            <Reveal key={s.index} delay={i * 0.06}>
              <div className="h-full rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-none">
                <span className="font-mono text-[22px] font-semibold text-[var(--color-brand-blue-deep)]">
                  {s.index}
                </span>
                <h3 className="mt-3 text-[16px] font-semibold text-[var(--color-brand-navy)]">
                  {s.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 列表：服务端渲染全部条目，客户端按 URL 参数过滤
          （页面保持静态，title/description 才会落在 <head> 内） */}
      <Section tone="surface" size="sm">
        <FilterRoot param="tab" defaultValue="demand">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            {(
              [
                { key: 'demand', label: '企业需求', count: all.filter((m) => m.type === 'demand').length },
                { key: 'supply', label: '社区能力', count: all.filter((m) => m.type === 'supply').length },
              ] as const
            ).map((t) => (
              <FilterLink
                key={t.key}
                href={`/market?tab=${t.key}`}
                param="tab"
                value={t.key}
                className="rounded-full bg-white px-5 py-2.5 text-[14px] font-medium text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)] transition-colors hover:text-[var(--color-brand-blue-deep)]"
              >
                {t.label}
                <span className="filter-count ml-1.5 text-[12px]"
                    data-filter-option-count>{t.count}</span>
              </FilterLink>
            ))}
          </div>
          {/* 关键词搜索：与 /agents、全局搜索共用同一个原语（SearchField）。
              实时写入 ?q= 并广播 jizhi:filter-change，由 FilterRoot 过滤。 */}
          <SearchField
            param="q"
            basePath="/market"
            label="搜索供需条目"
            placeholder="搜索需求标题、分类或发布方"
            className="w-full sm:w-auto sm:max-w-sm"
          />
        </div>

        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[20px] font-semibold text-[var(--color-brand-navy)]">供需条目</h2>
          {/* role=status：筛选后条数变化时由读屏播报「共 N 条」 */}
          <p role="status" className="text-[13px] text-[var(--color-ink-3)]">
            共 <span data-filter-count>{all.length}</span> 条
          </p>
        </div>

        <div className="mt-8" data-filter-empty style={{ display: 'none' }}>
          <EmptyState
            title="没有匹配的条目"
            desc="可能是当前关键词或分类下暂时没有公开条目。换个关键词、切换分类再试试；如果你要的是某个具体需求，直接提交给我们，我们会更快对接。"
          />
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {all.map((m, i) => {
              const isPrimary = i < PRIMARY_CARD_COUNT;
              return (
              <Reveal key={m.slug} delay={Math.min(i, 6) * 0.05}>
                <Link
                  href={`/market/${m.slug}`}
                  data-filter-key={m.type}
                  data-filter-text={searchItemText(marketToSearchItem(m))}
                  className={
                    isPrimary
                      ? 'group flex h-full flex-col rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[var(--shadow-lift)]'
                      : 'group flex h-full flex-col rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-none transition-colors duration-200 hover:border-[var(--color-brand-blue-deep)]/40 hover:bg-[var(--color-surface)]'
                  }
                >
                  <div className="flex items-center gap-2">
                    <Badge tone={m.type === 'demand' ? 'blue' : 'teal'} className="text-[12px]">
                      {m.type === 'demand' ? '需求方' : '供给方'}
                    </Badge>
                    <Badge tone="outline" className="text-[12px]">{m.category}</Badge>
                    <time className="ml-auto text-[12px] text-[var(--color-ink-3)]">
                      {m.published_at}
                    </time>
                  </div>
                  <h3 className="mt-4 text-[16px] font-semibold leading-snug text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue-deep)]">
                    {m.title}
                  </h3>
                  <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                    {m.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-[12px] text-[var(--color-ink-3)]">{m.org_name}</span>
                    {m.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded bg-[var(--color-surface)] px-2 py-0.5 text-[12px] text-[var(--color-ink-3)]">
                        {t}
                      </span>
                    ))}
                  </div>
                </Link>
              </Reveal>
              );
            })}
          </div>
        </FilterRoot>

        <div className="mt-10 rounded-2xl border border-[var(--color-line)] bg-white p-7">
          <h3 className="text-[16px] font-semibold text-[var(--color-brand-navy)]">
            关于「智能匹配」的真实说明
          </h3>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
            本期供需市场不提供自动撮合算法。你提交需求后，由社区运营团队人工对接、匹配合适的团队并安排沟通——我们不会用「已为你智能匹配」这类说法掩盖人工服务的过程。
          </p>
        </div>

        {/* 示例数据标注：与 /agents、/search 同一口径（PRD 明确要求示例内容必须标注，
            否则会被当成真实名录引用）。发布方已做匿名化处理。 */}
        <p className="mt-10 text-center text-[12px] text-[var(--color-ink-3)]">
          当前展示的供需条目为社区运营整理前的{' '}<span className="font-medium text-[var(--color-ink-2)]">示例内容</span>（发布方已匿名化），用于展示页面结构与排版；正式条目将按运营采集结果持续发布。
        </p>
      </Section>
    </>
  );
}
