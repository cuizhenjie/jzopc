import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/components/sections/Hero';
import StatsBar from '@/components/sections/StatsBar';
import EmpowerSection from '@/components/sections/EmpowerSection';
import { Advantages, Vision } from '@/components/sections/Advantages';
import Partners from '@/components/sections/Partners';
import { Section, SectionHead } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { Badge } from '@/components/ui/Card';
import { getNewsPosts, getPartners, getStats } from '@/lib/queries';
import { site } from '@/lib/site/config';

export const metadata: Metadata = {
  title: `${site.name} · ${site.slogan}`,
  description: site.description,
  alternates: { canonical: '/' },
};

export const revalidate = 300;

export default async function HomePage() {
  const [stats, partners, news] = await Promise.all([
    getStats(),
    getPartners(),
    getNewsPosts(),
  ]);

  return (
    <>
      <Hero />

      {/* 数据指标条 */}
      <Section size="sm" className="!py-12 sm:!py-14">
        <Reveal>
          <StatsBar stats={stats} />
        </Reveal>
      </Section>

      {/* 八大赋能 */}
      <Section id="empower-section" tone="surface">
        <SectionHead
          eyebrow="八大赋能"
          title={
            <>
              一站式 AI 应用
              <br className="hidden sm:block" />
              <span className="text-[var(--color-brand-blue-deep)]">综合赋能体系</span>
            </>
          }
          desc="场地、工具、算力、人才、服务、订单、流量、资金，八件事装进同一个社区，需求不出社区。"
        />
        <EmpowerSection />
      </Section>

      {/* 平台优势 + 愿景 */}
      <Section>
        {/* 不用两张同款卡片：改成两栏开放式排版 + 顶部色条，并且不等宽，
            避免「左右双胞胎」的模板感。 */}
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="border-t-2 border-[var(--color-brand-blue-deep)] pt-6">
            <Advantages />
          </div>
          <div className="border-t-2 border-[var(--color-brand-teal)] pt-6">
            <Vision />
          </div>
        </div>
      </Section>

      {/* 合作企业 */}
      <Section tone="surface" size="sm">
        <Partners names={partners} />
      </Section>

      {/* 社区动态精选 */}
      {news.length > 0 && (
        <Section size="sm">
          <SectionHead
            eyebrow="社区动态"
            title="社区正在发生什么"
            desc="沙龙、活动与最新资讯，第一时间了解社区与入驻团队的进展。"
            align="center"
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {news.slice(0, 3).map((n, i) => (
              // ⚠️ 跨列类必须挂在 **Reveal 包裹层**上：Reveal 渲染的那层 <div>
              //    才是真正的 grid item，类写在里面的 <Link> 上对布局无效。
              <Reveal key={n.slug} className={i === 0 ? 'sm:col-span-2 lg:col-span-2' : undefined}>
                <Link
                  href={`/news/${n.slug}`}
                  className={
                    // 首条横跨两列做主卡（更大内距 + 阴影），其余两条为次级卡
                    'group flex h-full flex-col border bg-white transition-all duration-300 ' +
                    (i === 0
                      ? 'rounded-2xl border-[var(--color-line)] p-7 shadow-[var(--shadow-card)] hover:-translate-y-1 hover:border-[var(--color-brand-blue-deep)]/30 hover:shadow-[var(--shadow-lift)]'
                      : 'rounded-xl border-[var(--color-line)] p-6 shadow-none hover:border-[var(--color-brand-blue-deep)]/40 hover:bg-[var(--color-surface)]')
                  }
                >
                  <div className="flex items-center gap-2">
                    <Badge tone="blue">{n.category}</Badge>
                    <time className="text-[12px] text-[var(--color-ink-3)]">{n.published_at}</time>
                  </div>
                  <h3 className="mt-4 text-[16px] font-semibold leading-snug text-[var(--color-brand-navy)] group-hover:text-[var(--color-brand-blue-deep)]">
                    {n.title}
                  </h3>
                  <p className="mt-3 flex-1 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                    {n.summary}
                  </p>
                  <span className="mt-5 text-[13px] font-medium text-[var(--color-brand-blue-deep)]">
                    阅读全文 →
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <ButtonLink href="/news" variant="secondary">
              查看全部动态
            </ButtonLink>
          </div>
        </Section>
      )}

      {/* CTA */}
      <Section tone="navy">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-14 text-center sm:px-12 sm:py-20">
          <div
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              background:
                'radial-gradient(60% 80% at 50% 0%, rgba(26,168,211,.22), transparent 70%), radial-gradient(50% 60% at 20% 100%, rgba(87,182,165,.16), transparent 70%)',
            }}
          />
          <div className="relative">
            <h2 className="text-[26px] font-semibold leading-tight text-white sm:text-[34px]">
              把创业缺的每一环提前铺好
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
              空间、算力、订单、流量、资金，一次对接。填写意向表单，社区团队会尽快与你沟通。
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3.5">
              <ButtonLink
                href="/apply"
                size="lg"
                className="!bg-white !text-[var(--color-brand-navy)] hover:!bg-[var(--color-brand-teal)] hover:!text-white"
              >
                申请入驻
              </ButtonLink>
              <ButtonLink href="/agents" size="lg" variant="light">
                浏览智能体
              </ButtonLink>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
