import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { EmptyState, Badge } from '@/components/ui/Card';
import { Reveal } from '@/components/ui/Reveal';
import FilterRoot from '@/components/ui/FilterRoot';
import FilterLink from '@/components/ui/FilterLink';
import { getNewsPosts } from '@/lib/queries';

export const metadata: Metadata = {
  title: '社区动态',
  description:
    '集智 AI OPC 社区的沙龙、活动与最新资讯。AI 时代一个人也能是一家公司，但不该是一个人扛下所有事。',
  alternates: { canonical: '/news' },
};

export const revalidate = 300;

const categories = ['沙龙', '活动', '资讯'] as const;

export default async function NewsPage() {
  const all = await getNewsPosts();
  const available = categories.filter((c) => all.some((n) => n.category === c));

  return (
    <>
      <PageHero
        eyebrow="社区动态"
        title="社区正在发生什么"
        desc="沙龙、活动与最新资讯。AI 时代一个人也能是一家公司，但不该是一个人扛下所有事。"
        crumbs={[{ label: '首页', href: '/' }, { label: '社区动态' }]}
      />

      <Section size="sm">
        {/* 分类筛选：服务端渲染全部条目，客户端按 URL 参数过滤
            （页面保持静态，title/description 才会落在 <head> 内） */}
        <FilterRoot param="category">
          <Reveal>
            <div className="flex flex-wrap gap-2">
              <FilterLink
                href="/news"
                param="category"
                value=""
                className="rounded-full bg-white px-5 py-2.5 text-[14px] font-medium text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)] transition-colors hover:text-[var(--color-brand-blue-deep)]"
              >
                全部
              </FilterLink>
              {available.map((c) => (
                <FilterLink
                  key={c}
                  href={`/news?category=${encodeURIComponent(c)}`}
                  param="category"
                  value={c}
                  className="rounded-full bg-white px-5 py-2.5 text-[14px] font-medium text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)] transition-colors hover:text-[var(--color-brand-blue-deep)]"
                >
                  {c}
                </FilterLink>
              ))}
            </div>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {all.map((n, i) => {
              const isFeatured = i === 0;
              return (
                <Reveal key={n.slug} className={isFeatured ? 'lg:col-span-2' : undefined}>
                  <Link
                    href={`/news/${n.slug}`}
                    data-filter-key={n.category}
                    data-filter-text={`${n.title} ${n.summary}`}
                    className={
                      isFeatured
                        ? 'group flex h-full flex-col rounded-2xl border border-[var(--color-line)] bg-white p-7 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-brand-blue-deep)]/30 hover:shadow-[var(--shadow-lift)]'
                        : 'group flex h-full flex-col rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-none transition-colors duration-200 hover:border-[var(--color-brand-blue-deep)]/40 hover:bg-[var(--color-surface)]'
                    }
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone="blue" className="text-[12px]">{n.category}</Badge>
                      <time className="text-[12px] text-[var(--color-ink-3)]">{n.published_at}</time>
                    </div>
                    <h2
                      className={
                        isFeatured
                          ? 'mt-4 text-[19px] font-semibold leading-snug text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue-deep)]'
                          : 'mt-4 text-[16px] font-semibold leading-snug text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue-deep)]'
                      }
                    >
                      {n.title}
                    </h2>
                    <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                      {n.summary}
                    </p>
                    <span className="mt-5 text-[13px] font-medium text-[var(--color-brand-blue-deep)]">
                      阅读全文 →
                    </span>
                  </Link>
                </Reveal>
              );
            })}
          </div>

          <div className="mt-10" data-filter-empty style={{ display: 'none' }}>
            <EmptyState
              title="该分类下暂无内容"
              desc="换个分类看看，或订阅我们，第一时间获取新动态。"
            />
          </div>
        </FilterRoot>
      </Section>
    </>
  );
}
