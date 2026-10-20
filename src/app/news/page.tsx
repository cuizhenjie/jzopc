import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { Badge, EmptyState } from '@/components/ui/Card';
import { Reveal } from '@/components/ui/Reveal';
import { getNewsPosts } from '@/lib/queries';

export const metadata: Metadata = {
  title: '社区动态',
  description: '集智 AI OPC 社区的沙龙、活动与最新资讯。',
  alternates: { canonical: '/news' },
};

export const revalidate = 300;

const categories = ['沙龙', '活动', '资讯'] as const;

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const all = await getNewsPosts();
  const available = categories.filter((c) => all.some((n) => n.category === c));
  const list = category ? all.filter((n) => n.category === category) : all;

  return (
    <>
      <PageHero
        eyebrow="社区动态"
        title="社区正在发生什么"
        desc="沙龙、活动与最新资讯。AI 时代一个人也能是一家公司，但不该是一个人扛下所有事。"
        crumbs={[{ label: '首页', href: '/' }, { label: '社区动态' }]}
      />

      <Section size="sm">
        <Reveal>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/news"
              className={
                !category
                  ? 'rounded-full bg-[var(--color-brand-blue)] px-5 py-2.5 text-[14px] font-medium text-white'
                  : 'rounded-full bg-white px-5 py-2.5 text-[14px] font-medium text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)] transition-colors hover:text-[var(--color-brand-blue)]'
              }
            >
              全部
            </Link>
            {available.map((c) => (
              <Link
                key={c}
                href={`/news?category=${encodeURIComponent(c)}`}
                className={
                  category === c
                    ? 'rounded-full bg-[var(--color-brand-blue)] px-5 py-2.5 text-[14px] font-medium text-white'
                    : 'rounded-full bg-white px-5 py-2.5 text-[14px] font-medium text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)] transition-colors hover:text-[var(--color-brand-blue)]'
                }
              >
                {c}
              </Link>
            ))}
          </div>
        </Reveal>

        {list.length === 0 ? (
          <div className="mt-10">
            <EmptyState title="该分类下暂无内容" desc="换个分类看看，或订阅我们，第一时间获取新动态。" />
          </div>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((n, i) => (
              <Reveal key={n.slug} delay={Math.min(i, 8) * 0.04}>
                <Link
                  href={`/news/${n.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-[var(--color-line)] bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[var(--shadow-lift)]"
                >
                  <div className="flex items-center gap-2">
                    <Badge tone="blue">{n.category}</Badge>
                    <time className="text-[12px] text-[var(--color-ink-3)]">{n.published_at}</time>
                  </div>
                  <h2 className="mt-4 text-[16px] font-semibold leading-snug text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue)]">
                    {n.title}
                  </h2>
                  <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                    {n.summary}
                  </p>
                  <span className="mt-5 text-[13px] font-medium text-[var(--color-brand-blue)]">阅读全文 →</span>
                </Link>
              </Reveal>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
