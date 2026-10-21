import type { Metadata } from 'next';
import Link from 'next/link';
import Hero from '@/components/sections/Hero';
import StatsBar from '@/components/sections/StatsBar';
import EmpowerSection from '@/components/sections/EmpowerSection';
import { Advantages, Vision } from '@/components/sections/Advantages';
import Partners from '@/components/sections/Partners';
import { Section } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { getNewsPosts, getPartners, getStats } from '@/lib/queries';
import { site } from '@/lib/site/config';

export const metadata: Metadata = {
  title: `${site.name} · ${site.slogan}`,
  description: site.description,
  alternates: { canonical: '/' },
};

export const revalidate = 300;

export default async function HomePage() {
  const [stats, partners, news] = await Promise.all([getStats(), getPartners(), getNewsPosts()]);
  const featured = news[0];

  return (
    <>
      <Hero />
      <Section size="sm" className="home-stats-section"><StatsBar stats={stats} /></Section>

      <Section id="empower-section" tone="surface" className="empower-home">
        <div className="section-intro">
          <div>
            <span className="section-eyebrow">01 / 八大赋能</span>
            <h2>一站式 AI 应用<br />综合赋能体系</h2>
          </div>
          <p>场地、工具、算力、人才、服务、订单、流量、资金。八件事装进同一个社区，需求不出社区。</p>
        </div>
        <EmpowerSection />
      </Section>

      <Section className="community-home">
        <div className="community-intro">
          <div>
            <span className="section-eyebrow">02 / 认识集智</span>
            <h2>AI 时代，<br />一个人也能是一家公司。</h2>
          </div>
          <div>
            <p>{site.company}旗下，面向 AI 创业团队与「一人公司」的一站式赋能平台。位于北京丰台大红门，首期占地超 3000 平方米。</p>
            <Link href="/about" className="editorial-link">了解集智社区 <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
        <div className="community-values"><Advantages /><Vision /></div>
      </Section>

      <Section tone="surface" size="sm"><Partners names={partners} /></Section>

      {featured && (
        <Section className="news-home">
          <div className="news-heading">
            <div><span className="section-eyebrow">03 / 社区动态</span><h2>社区正在发生什么</h2></div>
            <Link href="/news" className="editorial-link">全部动态 <span aria-hidden="true">↗</span></Link>
          </div>
          <div className={news.length > 1 ? 'news-editorial' : 'news-editorial news-editorial-single'}>
            <Reveal>
              <Link href={`/news/${featured.slug}`} className="news-feature">
                <div className="news-meta"><span>{featured.category}</span><time dateTime={featured.published_at}>{featured.published_at}</time></div>
                <h3>{featured.title}</h3>
                <p>{featured.summary}</p>
                <span className="editorial-link">阅读全文 <span aria-hidden="true">↗</span></span>
                <span className="news-feature-index" aria-hidden="true">JZ.</span>
              </Link>
            </Reveal>
            {news.length > 1 && <div className="news-secondary">
              {news.slice(1, 3).map((item) => (
                <Link href={`/news/${item.slug}`} key={item.slug} className="news-row">
                  <div className="news-meta"><span>{item.category}</span><time dateTime={item.published_at}>{item.published_at}</time></div>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <span className="news-row-arrow" aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>}
          </div>
        </Section>
      )}

      <Section tone="navy" className="home-cta">
        <div className="cta-layout">
          <div><span className="section-eyebrow">申请入驻</span><h2>把创业缺的<br />每一环提前铺好</h2></div>
          <div className="cta-content">
            <p>空间、算力、订单、流量、资金，一次对接。填写意向表单，社区团队会尽快与你沟通。</p>
            <div className="cta-actions">
              <ButtonLink href="/apply" size="lg" className="hero-primary">申请入驻 <span aria-hidden="true">↗</span></ButtonLink>
              <ButtonLink href="/agents" size="lg" variant="light">浏览智能体</ButtonLink>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
