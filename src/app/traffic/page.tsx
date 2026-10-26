import type { Metadata } from 'next';
import { Section, SectionHead } from '@/components/ui/Section';
import PageHero from '@/components/layout/PageHero';
import { Reveal } from '@/components/ui/Reveal';
import StaggerIn from '@/components/anim/StaggerIn';
import CountUp from '@/components/anim/CountUp';
import { ButtonLink } from '@/components/ui/Button';
import { trafficBase, trafficMiniappQr } from '@/lib/data/traffic-base';
import { site } from '@/lib/site/config';
import styles from './traffic.module.css';

export const metadata: Metadata = {
  title: '集智AIGC新媒体流量基地',
  description: `${trafficBase.slogan}。${trafficBase.name}——集美控股集团产教融合标杆项目，提供企业商业交付、FDE AI落地专项、院校产教共建与人才孵化培训。`,
  alternates: { canonical: '/traffic' },
};

const businessGroups = ['B端服务', 'S端服务', 'C端服务'] as const;

export default function TrafficPage() {
  const { intro, advantages, businesses, growth, network, cases, invitation } = trafficBase;

  return (
    <div className={styles.page}>
      <PageHero eyebrow="流量超市" title={trafficBase.name} desc={trafficBase.slogan}>
        <ul className={styles.values} aria-label="核心价值观">
          {intro.values.map(value => <li key={value}>{value}</li>)}
        </ul>
      </PageHero>

      <Section className={styles.section}>
        <div className={styles.sectionHeading}>
          <SectionHead eyebrow="基地简介 · Who We Are" title="集美控股旗下产教融合标杆项目" />
        </div>
        <div className={styles.introLayout}>
          <Reveal>
            <p className={styles.body}>{intro.paragraph}</p>
            <div className={styles.industries}>
              <h3>依托集团全链条产业资源</h3>
              <ul>{intro.industries.map(industry => <li key={industry}>{industry}</li>)}</ul>
            </div>
          </Reveal>
          <Reveal delay={0.06}>
            <dl className={styles.pillars}>
              {intro.pillars.map(pillar => (
                <div key={pillar.label}>
                  <dt>{pillar.label}</dt>
                  <dd>{pillar.text}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </Section>

      <Section tone="surface" className={styles.section}>
        <div className={styles.sectionHeading}>
          <SectionHead eyebrow="核心优势 · Why Choose Us" title="四项核心优势" />
        </div>
        <StaggerIn className={styles.advantages} y={12}>
          {advantages.map((advantage, index) => (
            <article key={advantage.title} className={styles.advantage}>
              <span className={styles.index} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <h3>{advantage.title}</h3>
              <p>{advantage.desc}</p>
            </article>
          ))}
        </StaggerIn>
      </Section>

      <Section className={styles.section}>
        <div className={styles.sectionHeading}>
          <SectionHead eyebrow="核心业务生态 · What We Do" title="B 端交付 · S 端共建 · C 端孵化" />
        </div>
        <div className={styles.businessChapters}>
          {businessGroups.map(tag => (
            <Reveal key={tag}>
              <section className={styles.businessChapter} aria-labelledby={`traffic-business-${tag[0]}`}>
                <header className={styles.chapterLabel}>
                  <span aria-hidden="true">{tag[0]}</span>
                  <h3 id={`traffic-business-${tag[0]}`}>{tag}</h3>
                </header>
                <div className={styles.businessContent}>
                  {businesses.filter(business => business.tag === tag).map(business => (
                    <article key={business.title} className={styles.business}>
                      <h4>{business.title}</h4>
                      {'subtitle' in business && <p className={styles.businessSubtitle}>{business.subtitle}</p>}
                      {'lead' in business && <p className={styles.businessLead}>{business.lead}</p>}
                      <dl className={`${styles.services} ${business.items.length === 3 ? styles.threeServices : ''}`}>
                        {business.items.map(item => (
                          <div key={item.title}>
                            <dt>{item.title}</dt>
                            <dd>{item.desc}</dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  ))}
                </div>
              </section>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section tone="surface" className={styles.section}>
        <div className={styles.sectionHeading}>
          <SectionHead eyebrow="人才成长闭环 · How We Empower Students" title="从实训学员到项目合伙人" desc={growth.lead} />
        </div>
        <Reveal>
          <h3 className={styles.ladderTitle}>{growth.ladderTitle}</h3>
          <ol className={styles.ladder}>
            {growth.ladder.map((step, index) => (
              <li key={step}>
                <span className={styles.stepNumber} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Reveal>
        <StaggerIn className={styles.growthPoints} y={12}>
          {growth.points.map(point => (
            <article key={point.title}>
              <h3>{point.title}</h3>
              <p>{point.desc}</p>
            </article>
          ))}
        </StaggerIn>
      </Section>

      <Section className={styles.section}>
        <div className={styles.sectionHeading}>
          <SectionHead
            eyebrow="全国基地网络 · Our Network"
            title={`${network.tiers.join(' — ')}，面向全国标准化复制`}
            desc={network.lead}
          />
        </div>
        <StaggerIn className={styles.bases} y={12}>
          {network.bases.map((base, index) => (
            <article key={base.name}>
              <span className={styles.index} aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <h3>{base.name}</h3>
              <p>{base.role}</p>
            </article>
          ))}
        </StaggerIn>
        <Reveal>
          <p className={styles.networkMore}>{network.more}</p>
          <p className={styles.note}>（注：{network.note}）</p>
        </Reveal>
      </Section>

      <Section tone="navy" className={`${styles.section} ${styles.casesSection}`}>
        <div className={styles.sectionHeading}>
          <SectionHead dark eyebrow="标杆服务案例 · Success Stories" title="核心案例数据战报" desc="以下为基地团队操盘的真实交付成果。" />
        </div>
        <StaggerIn className={styles.cases} y={12}>
          {cases.map((item, index) => (
            <article key={item.brand} className={`${styles.case} ${index < 2 ? styles.featuredCase : ''}`}>
              <h3>{item.brand}</h3>
              <p className={styles.caseMetric}>
                <CountUp value={item.metric.value} suffix={item.metric.suffix} />
              </p>
              <p className={styles.caseLabel}>{item.metric.label}</p>
              <ul className={styles.caseFacts}>{item.facts.map(fact => <li key={fact}>{fact}</li>)}</ul>
            </article>
          ))}
        </StaggerIn>
      </Section>

      <Section id="join" className={styles.section}>
        <div className={styles.sectionHeading}>
          <SectionHead eyebrow="合作邀请 · Join Us" title="期待与您携手" desc={invitation.lead} />
        </div>
        <div className={styles.invitationLayout}>
          <dl className={styles.audiences}>
            {invitation.audiences.map((audience, index) => (
              <Reveal key={audience.to} delay={index * 0.04} className={styles.audience}>
                <dt>{audience.to}</dt>
                <dd>{audience.text}</dd>
              </Reveal>
            ))}
          </dl>
          <Reveal delay={0.08}>
            <aside className={styles.contact} aria-labelledby="traffic-contact-title">
              <h3 id="traffic-contact-title">{invitation.channels.join(' / ')}</h3>
              <p>
                {trafficMiniappQr
                  ? '请扫描下方二维码，或联系我们的专属顾问。'
                  : '请联系我们的专属顾问，或通过下方入口前往统一咨询页留言。'}
              </p>
              <dl className={styles.contactDetails}>
                <div>
                  <dt>电话</dt>
                  <dd><a href={`tel:${site.contact.phone.replace(/-/g, '')}`}>{site.contact.phone}</a></dd>
                </div>
                <div>
                  <dt>邮箱</dt>
                  <dd><a href={`mailto:${site.contact.email}`}>{site.contact.email}</a></dd>
                </div>
              </dl>
              {trafficMiniappQr && (
                <figure className={styles.qr}>
                  <img src={trafficMiniappQr.src} alt={trafficMiniappQr.alt} width={160} height={160} decoding="async" />
                  <figcaption>{trafficMiniappQr.alt}</figcaption>
                </figure>
              )}
              <div className={styles.contactAction}>
                <ButtonLink href="/apply" size="lg">
                  前往统一咨询页
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
                    <path d="M2.5 8h11m0 0L9.5 4m4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </ButtonLink>
              </div>
            </aside>
          </Reveal>
        </div>
        <Reveal>
          <p className={styles.compliance}><strong>合规声明：</strong>{invitation.compliance}</p>
        </Reveal>
      </Section>
    </div>
  );
}
