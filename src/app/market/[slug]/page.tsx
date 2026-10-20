import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Section } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import LeadForm from '@/components/forms/LeadForm';
import { Badge } from '@/components/ui/Card';
import { getMarketItem, getMarketItems } from '@/lib/queries';

export const revalidate = 600;

/**
 * 预渲染全部供需条目。
 *
 * 不加这个函数，页面会走动态渲染，Next.js 会把 <title> / <meta description>
 * 一起 flush 到 </body> 之后 —— 搜索引擎读不到（实测确认）。
 * 与 /agents/[slug] 保持一致的处理方式。
 */
export function generateStaticParams() {
  return getMarketItems().then((list) => list.map((m) => ({ slug: m.slug })));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = await getMarketItem(slug);
  if (!item) return { title: '供需详情' };
  return {
    title: item.title,
    description: item.summary,
    alternates: { canonical: `/market/${item.slug}` },
  };
}

export default async function MarketDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const item = await getMarketItem(slug);
  if (!item) notFound();

  return (
    <>
      <PageHero
        eyebrow={item.type === 'demand' ? '企业需求' : '社区能力'}
        title={item.title}
        desc={item.summary}
        crumbs={[
          { label: '首页', href: '/' },
          { label: '供需市场', href: '/market' },
          { label: item.title },
        ]}
      />

      <Section size="sm">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={item.type === 'demand' ? 'blue' : 'teal'} className="text-[12px]">
                {item.type === 'demand' ? '需求方' : '供给方'}
              </Badge>
              <Badge tone="outline" className="text-[12px]">{item.category}</Badge>
              <time className="text-[12px] text-[var(--color-ink-3)]">发布于 {item.published_at}</time>
            </div>

            <h2 className="mt-8 text-[19px] font-semibold text-[var(--color-brand-navy)]">详情说明</h2>
            <p className="mt-4 text-[15px] leading-[1.9] text-[var(--color-ink-2)]">{item.summary}</p>
            {/* 完整描述（DB 列 body jsonb，运营填写后显示；本期种子为空则不渲染） */}
            {item.body && item.body.length > 0 && (
              <div className="mt-4 space-y-3">
                {item.body.map((p, i) => (
                  <p key={i} className="text-[15px] leading-[1.9] text-[var(--color-ink-2)]">
                    {p}
                  </p>
                ))}
              </div>
            )}

            <h3 className="mt-9 text-[15px] font-semibold text-[var(--color-brand-navy)]">相关标签</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {item.tags.map((t) => (
                <Badge key={t} tone="outline" className="text-[12px]">
                  {t}
                </Badge>
              ))}
            </div>

            <div className="mt-9 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-card)]">
              <h3 className="text-[15px] font-semibold text-[var(--color-brand-navy)]">对接方式</h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                社区不公开双方联系方式。你提交合作意向后，由社区运营在双方之间做一轮对接，确认意向后再安排具体沟通。
              </p>
            </div>
          </div>

          <aside>
            <LeadForm
              leadType="market"
              sourcePage={`/market/${item.slug}`}
              sourceRef={item.slug}
              title="提交合作意向"
              desc={`就「${item.title}」与社区对接`}
              compact
            />
          </aside>
        </div>
      </Section>
    </>
  );
}
