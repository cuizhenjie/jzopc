import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, SectionHead } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { Badge, EmptyState } from '@/components/ui/Card';
import { Reveal } from '@/components/ui/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { getMarketItems } from '@/lib/queries';
import { marketHero } from '@/lib/data/seed';
import { marketSteps } from '@/lib/site/config';

export const metadata: Metadata = {
  title: '供需市场',
  description: marketHero.subtitle,
  alternates: { canonical: '/market' },
};

export const revalidate = 600;

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active = tab === 'supply' ? 'supply' : 'demand';
  const all = await getMarketItems();
  const list = all.filter((m) => m.type === active);

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
              <div className="h-full rounded-2xl border border-[var(--color-line)] bg-white p-6">
                <span className="font-mono text-[22px] font-semibold text-[var(--color-brand-blue)]">
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

      {/* 列表 */}
      <Section tone="surface" size="sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex gap-2">
            {(
              [
                { key: 'demand', label: '企业需求', count: all.filter((m) => m.type === 'demand').length },
                { key: 'supply', label: '社区能力', count: all.filter((m) => m.type === 'supply').length },
              ] as const
            ).map((t) => (
              <Link
                key={t.key}
                href={`/market?tab=${t.key}`}
                className={
                  active === t.key
                    ? 'rounded-full bg-[var(--color-brand-blue)] px-5 py-2.5 text-[14px] font-medium text-white'
                    : 'rounded-full bg-white px-5 py-2.5 text-[14px] font-medium text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)] transition-colors hover:text-[var(--color-brand-blue)]'
                }
              >
                {t.label}
                <span className="ml-1.5 text-[12px] opacity-70">{t.count}</span>
              </Link>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              title="暂时没有公开条目"
              desc="你提交的需求会由社区运营整理后发布到这里。直接提交，我们会更快对接。"
            />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {list.map((m, i) => (
              <Reveal key={m.slug} delay={Math.min(i, 6) * 0.05}>
                <Link
                  href={`/market/${m.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-[var(--color-line)] bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-brand-blue)]/30 hover:shadow-[var(--shadow-lift)]"
                >
                  <div className="flex items-center gap-2">
                    <Badge tone={m.type === 'demand' ? 'blue' : 'teal'}>
                      {m.type === 'demand' ? '需求方' : '供给方'}
                    </Badge>
                    <Badge tone="outline">{m.category}</Badge>
                    <time className="ml-auto text-[12px] text-[var(--color-ink-3)]">
                      {m.published_at}
                    </time>
                  </div>
                  <h3 className="mt-4 text-[16px] font-semibold leading-snug text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue)]">
                    {m.title}
                  </h3>
                  <p className="mt-2.5 flex-1 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                    {m.summary}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-[12px] text-[var(--color-ink-3)]">{m.org_name}</span>
                    {m.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-ink-3)]">
                        {t}
                      </span>
                    ))}
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        )}

        <div className="mt-10 rounded-2xl border border-[var(--color-line)] bg-white p-7">
          <h3 className="text-[16px] font-semibold text-[var(--color-brand-navy)]">
            关于「智能匹配」的真实说明
          </h3>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
            本期供需市场不提供自动撮合算法。你提交需求后，由社区运营团队人工对接、匹配合适的团队并安排沟通——我们不会用「已为你智能匹配」这类说法掩盖人工服务的过程。
          </p>
        </div>
      </Section>
    </>
  );
}
