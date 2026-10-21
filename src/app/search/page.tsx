import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, SectionHead } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { Badge, EmptyState } from '@/components/ui/Card';
import FilterRoot from '@/components/ui/FilterRoot';
import FilterLink from '@/components/ui/FilterLink';
import SearchField from '@/components/ui/SearchField';
import { buildSearchIndex } from '@/lib/search';
import { searchItemText, type SearchItemType } from '@/lib/search/matcher';

export const metadata: Metadata = {
  title: '站内搜索',
  description: '搜索集智 AI 社区的智能体、供需、课程与社区动态，可按类型筛选，链接可分享。',
  alternates: { canonical: '/search' },
};

export const revalidate = 600;

/**
 * 分类筛选项。
 *
 * `value` 为空串表示「全部」（FilterLink 会删掉该参数），
 * 其余取值与 `SearchItem.type` 一一对应 —— 也就是 `data-filter-key` 的值。
 */
const TYPE_FILTERS: { value: '' | SearchItemType; label: string }[] = [
  { value: '', label: '全部' },
  { value: 'agent', label: '智能体' },
  { value: 'market', label: '供需' },
  { value: 'course', label: '课程' },
  { value: 'news', label: '动态' },
];

export default async function SearchPage() {
  const items = await buildSearchIndex();

  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.type] = (acc[item.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHero
        eyebrow="站内搜索"
        title="搜索智能体、供需、课程与动态"
        desc="一个搜索框覆盖全站内容。筛选条件写在地址栏里，复制链接即可把当前结果分享给别人。"
        crumbs={[{ label: '首页', href: '/' }, { label: '站内搜索' }]}
      />

      <Section size="sm">
        <SectionHead
          eyebrow="搜索"
          title="全站内容，一处搜完"
          desc="结果在浏览器里按关键词与分类即时过滤；不输入关键词时展示全部条目。"
        />

        {/* 列表：服务端渲染全部条目，客户端按 URL 参数过滤
            （页面保持静态，title/description 才会落在 <head> 内） */}
        <FilterRoot param="type" queryParam="q">
          <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 sm:p-6">
            <SearchField
              param="q"
              basePath="/search"
              placeholder="搜索智能体、供需、课程与动态"
              className="max-w-xl"
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {TYPE_FILTERS.map((t) => (
                <FilterLink
                  key={t.value || 'all'}
                  href={t.value ? `/search?type=${t.value}` : '/search'}
                  param="type"
                  value={t.value}
                  className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)] transition-colors hover:text-[var(--color-brand-blue-deep)]"
                >
                  {t.label}
                  <span className="filter-count ml-1.5 text-[12px]">
                    {t.value ? (counts[t.value] ?? 0) : items.length}
                  </span>
                </FilterLink>
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-[20px] font-semibold text-[var(--color-brand-navy)]">搜索结果</h2>
            <p className="text-[13px] text-[var(--color-ink-3)]">
              共 <span data-filter-count>{items.length}</span> 条
            </p>
          </div>

          <div className="mt-6" data-filter-empty style={{ display: 'none' }}>
            <EmptyState
              title="没有找到匹配的内容"
              desc="换个关键词试试，或切换到其它分类再看看。智能体目录与供需市场仍在持续更新。"
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-filter-key={item.type}
                data-filter-text={searchItemText(item)}
                className="group flex h-full flex-col rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-none transition-colors duration-200 hover:border-[var(--color-brand-blue-deep)]/40 hover:bg-[var(--color-surface)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="blue" className="text-[12px]">
                    {item.typeLabel}
                  </Badge>
                  {item.category ? (
                    <Badge tone="outline" className="text-[12px]">
                      {item.category}
                    </Badge>
                  ) : null}
                </div>
                <h3 className="mt-4 text-[16px] font-semibold leading-snug text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue-deep)]">
                  {item.title}
                </h3>
                <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                  {item.summary}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-brand-blue-deep)]">
                  查看详情
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" fill="none" aria-hidden="true">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </FilterRoot>

        <p className="mt-10 text-center text-[12px] text-[var(--color-ink-3)]">
          搜索范围覆盖智能体目录、供需市场、集智学院课程与社区动态，共 {items.length} 条内容；这些条目当前为社区开箱即用的**示例内容**（智能体目录尤其如此），正式清单将按社区采集结果持续更新。
        </p>
      </Section>
    </>
  );
}
