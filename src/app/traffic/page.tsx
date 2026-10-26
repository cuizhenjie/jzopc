import type { Metadata } from 'next';
import { Section, SectionHead } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { Reveal } from '@/components/ui/Reveal';
import StaggerIn from '@/components/anim/StaggerIn';
import CountUp from '@/components/anim/CountUp';
import { Badge } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { trafficBase, trafficMiniappQr } from '@/lib/data/traffic-base';
import { site } from '@/lib/site/config';

export const metadata: Metadata = {
  title: '集智AIGC新媒体流量基地',
  description: `${trafficBase.slogan}。${trafficBase.name}——集美控股集团产教融合标杆项目，提供企业商业交付、FDE AI落地专项、院校产教共建与人才孵化培训。`,
  alternates: { canonical: '/traffic' },
};

/** B/S/C 三端服务各配一枚标签色，读的时候一眼分清业务对象 */
const businessTone = { B端服务: 'blue', S端服务: 'teal', C端服务: 'outline' } as const;

export default function TrafficPage() {
  const { intro, advantages, businesses, growth, network, cases, invitation } = trafficBase;

  return (
    <>
      <PageHero eyebrow="流量超市" title={trafficBase.name} desc={trafficBase.slogan}>
        <div className="flex flex-wrap gap-2">
          {intro.values.map((v) => (
            <span key={v} className="page-hero-tag rounded px-4 py-1.5 text-[13px] font-medium">
              {v}
            </span>
          ))}
        </div>
      </PageHero>

      {/* 一、基地简介 */}
      <Section>
        <SectionHead
          eyebrow="基地简介 · Who We Are"
          title="集美控股旗下产教融合标杆项目"
        />
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div>
            <p className="text-[15px] leading-loose text-[var(--color-ink-2)]">
              {intro.paragraph}
            </p>
            <div className="mt-7">
              <p className="text-[12px] font-medium tracking-[0.18em] text-[var(--color-brand-blue-deep)]">
                依托集团全链条产业资源
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {intro.industries.map((ind) => (
                  <span
                    key={ind}
                    className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1 text-[13px] text-[var(--color-ink-2)]"
                  >
                    {ind}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            {intro.pillars.map((p, i) => (
              <Reveal key={p.label} delay={i * 0.05}>
                <div className="relative rounded-xl border border-[var(--color-line)] bg-white p-5 pt-6">
                  <span
                    aria-hidden="true"
                    className="absolute left-5 top-0 h-[2px] w-10 rounded-full bg-[linear-gradient(90deg,var(--color-brand-blue),var(--color-brand-cyan))]"
                  />
                  <h3 className="text-[13px] font-semibold tracking-[0.12em] text-[var(--color-brand-blue-deep)]">
                    {p.label}
                  </h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
                    {p.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* 二、核心优势 */}
      <Section tone="surface">
        <SectionHead eyebrow="核心优势 · Why Choose Us" title="四项核心优势" />
        <StaggerIn className="grid gap-4 sm:grid-cols-2">
          {advantages.map((a, i) => (
            <div
              key={a.title}
              className="relative h-full rounded-xl border border-[var(--color-line)] bg-white p-5 pt-6 transition-all duration-300 ease-out hover:-translate-y-[3px] hover:border-[var(--color-brand-blue)]/50 hover:shadow-[var(--shadow-lift)]"
            >
              <span
                aria-hidden="true"
                className="absolute left-5 top-0 h-[2px] w-10 rounded-full bg-[linear-gradient(90deg,var(--color-brand-blue),var(--color-brand-cyan))]"
              />
              <span className="font-mono text-[12px] font-semibold tracking-widest text-[var(--color-brand-blue)]">
                {String(i + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-1.5 text-[16px] font-semibold text-[var(--color-brand-navy)]">
                {a.title}
              </h3>
              <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                {a.desc}
              </p>
            </div>
          ))}
        </StaggerIn>
      </Section>

      {/* 三、核心业务生态 */}
      <Section>
        <SectionHead
          eyebrow="核心业务生态 · What We Do"
          title="B 端交付 · S 端共建 · C 端孵化"
        />
        <div className="space-y-6">
          {businesses.map((b, i) => (
            <Reveal key={b.title} delay={Math.min(i, 4) * 0.04}>
              <div className="rounded-2xl border border-[var(--color-line)] bg-white p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={businessTone[b.tag]}>{b.tag}</Badge>
                  <h3 className="text-[18px] font-semibold text-[var(--color-brand-navy)]">
                    {b.title}
                  </h3>
                  {b.subtitle && (
                    <span className="text-[14px] text-[var(--color-brand-blue-deep)]">
                      ——{b.subtitle}
                    </span>
                  )}
                </div>
                {b.lead && (
                  <p className="mt-3 max-w-4xl text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
                    {b.lead}
                  </p>
                )}
                <dl className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                  {b.items.map((item) => (
                    <div key={item.title} className="border-l-2 border-[var(--color-brand-blue)]/20 pl-4">
                      <dt className="text-[14px] font-semibold text-[var(--color-brand-navy)]">
                        {item.title}
                      </dt>
                      <dd className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                        {item.desc}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 四、人才成长闭环 */}
      <Section tone="surface">
        <SectionHead
          eyebrow="人才成长闭环 · How We Empower Students"
          title="从实训学员到项目合伙人"
          desc={growth.lead}
        />
        <Reveal>
          <div className="rounded-2xl border border-[var(--color-line)] bg-white p-6 sm:p-8">
            <h3 className="text-[14px] font-semibold text-[var(--color-brand-navy)]">
              {growth.ladderTitle}
            </h3>
            <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3">
              {growth.ladder.map((step, i) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2 text-[14px] font-medium text-[var(--color-brand-navy)]">
                    <span className="font-mono text-[12px] text-[var(--color-brand-blue)]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {step}
                  </span>
                  {i < growth.ladder.length - 1 && (
                    <span aria-hidden="true" className="text-[var(--color-ink-3)]">
                      →
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {growth.points.map((p, i) => (
            <Reveal key={p.title} delay={0.05 + i * 0.05}>
              <div className="h-full rounded-xl border border-[var(--color-line)] bg-white p-6">
                <h3 className="text-[15px] font-semibold text-[var(--color-brand-navy)]">
                  {p.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                  {p.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 五、全国基地网络 */}
      <Section>
        <SectionHead
          eyebrow="全国基地网络 · Our Network"
          title="总部 — 大区 — 基地 — 班级，面向全国标准化复制"
          desc={network.lead}
        />
        <StaggerIn className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {network.bases.map((base) => (
            <div
              key={base.name}
              className="h-full rounded-xl border border-[var(--color-line)] bg-white p-6 transition-all duration-300 hover:-translate-y-[3px] hover:border-[var(--color-brand-blue)]/50 hover:shadow-[var(--shadow-lift)]"
            >
              <h3 className="text-[16px] font-semibold text-[var(--color-brand-navy)]">
                {base.name}
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                {base.role}
              </p>
            </div>
          ))}
          <div className="flex h-full flex-col justify-center rounded-xl border border-dashed border-[var(--color-brand-blue)]/30 bg-[var(--color-surface)] p-6 text-center">
            <p className="text-[14px] font-medium text-[var(--color-brand-navy)]">
              {network.more}
            </p>
          </div>
        </StaggerIn>
        <Reveal delay={0.1}>
          <p className="mt-6 text-[12.5px] leading-relaxed text-[var(--color-ink-3)]">
            （注：{network.note}）
          </p>
        </Reveal>
      </Section>

      {/* 六、标杆服务案例（数据战报） */}
      <Section tone="navy">
        <SectionHead
          dark
          eyebrow="标杆服务案例 · Success Stories"
          title="核心案例数据战报"
          desc="以下为基地团队操盘的真实交付成果。"
        />
        <StaggerIn className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <div
              key={c.brand}
              className="h-full rounded-xl border border-white/15 bg-white/[.06] p-6 transition-colors duration-200 hover:border-white/30 hover:bg-white/[.09]"
            >
              <p className="text-[13px] font-medium tracking-wide text-white/75">{c.brand}</p>
              <p className="tnum mt-3 text-[30px] font-bold leading-[1.1] text-[var(--color-brand-cyan)]">
                <CountUp value={c.metric.value} suffix={c.metric.suffix} />
              </p>
              <p className="mt-1.5 text-[13px] text-white/60">{c.metric.label}</p>
              <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-4">
                {c.facts.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] leading-relaxed text-white/75">
                    <svg viewBox="0 0 16 16" className="mt-1 h-3 w-3 shrink-0" fill="none" aria-hidden="true">
                      <path
                        d="M3 8.5 6.2 11.5 13 4.5"
                        stroke="var(--color-brand-cyan)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </StaggerIn>
      </Section>

      {/* 七、合作邀请 */}
      <Section id="join">
        <SectionHead eyebrow="合作邀请 · Join Us" title="期待与您携手" desc={invitation.lead} />
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
          <div>
            <div className="space-y-4">
              {invitation.audiences.map((a, i) => (
                <Reveal key={a.to} delay={i * 0.05}>
                  <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
                    <h3 className="text-[15px] font-semibold text-[var(--color-brand-blue-deep)]">
                      {a.to}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                      {a.text}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.15}>
              <div className="mt-6 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-6 sm:p-7">
                <h3 className="text-[16px] font-semibold text-[var(--color-brand-navy)]">
                  {invitation.channels.join(' / ')}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                  {trafficMiniappQr
                    ? '请扫描下方二维码，或联系我们的专属顾问。'
                    : '请联系我们的专属顾问，或通过右侧入口前往统一咨询页留言。'}
                </p>
                <dl className="mt-5 space-y-3 text-[14px]">
                  <div className="flex items-center gap-3">
                    <dt className="w-14 shrink-0 text-[13px] text-[var(--color-ink-3)]">电话</dt>
                    <dd>
                      <a
                        href={`tel:${site.contact.phone.replace(/-/g, '')}`}
                        className="font-medium text-[var(--color-brand-blue-deep)] underline-offset-4 hover:underline"
                      >
                        {site.contact.phone}
                      </a>
                    </dd>
                  </div>
                  <div className="flex items-center gap-3">
                    <dt className="w-14 shrink-0 text-[13px] text-[var(--color-ink-3)]">邮箱</dt>
                    <dd className="min-w-0">
                      <a
                        href={`mailto:${site.contact.email}`}
                        className="break-all font-medium text-[var(--color-brand-blue-deep)] underline-offset-4 hover:underline"
                      >
                        {site.contact.email}
                      </a>
                    </dd>
                  </div>
                </dl>
                {trafficMiniappQr && (
                  <figure className="mt-6 flex flex-col items-start gap-3">
                    <img
                      src={trafficMiniappQr.src}
                      alt={trafficMiniappQr.alt}
                      width={160}
                      height={160}
                      decoding="async"
                      className="rounded-lg border border-[var(--color-line)] bg-white p-2"
                    />
                    <figcaption className="text-[12px] text-[var(--color-ink-3)]">
                      {trafficMiniappQr.alt}
                    </figcaption>
                  </figure>
                )}
              </div>
            </Reveal>
          </div>

          {/* 2026-10-26 表单下线：线索统一收敛到 /apply 统一留资页，这里只留按钮入口 */}
          <Reveal delay={0.15}>
            <div className="flex h-full flex-col justify-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-8 sm:p-10">
              <h3 className="text-[18px] font-semibold text-[var(--color-brand-navy)]">
                留言咨询
              </h3>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-[var(--color-ink-2)]">
                商务合作、院校共建或实训报名，请前往统一咨询页留下您的需求与联系方式，专属顾问会尽快与您对接。
              </p>
              <div className="mt-7">
                <ButtonLink href="/apply" size="lg" className="w-full sm:w-auto">
                  前往统一咨询页
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
                    <path
                      d="M2.5 8h11m0 0L9.5 4m4 4-4 4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </ButtonLink>
              </div>
              <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--color-ink-3)]">
                也可直接拨打左侧顾问电话或发送邮件洽谈。
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <p className="mt-10 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 text-[12.5px] leading-relaxed text-[var(--color-ink-3)]">
            <strong className="text-[var(--color-ink-2)]">合规声明：</strong>
            {invitation.compliance}
          </p>
        </Reveal>
      </Section>
    </>
  );
}
