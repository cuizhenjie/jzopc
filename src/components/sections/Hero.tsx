'use client';

import dynamic from 'next/dynamic';
import { ButtonLink } from '@/components/ui/Button';
import { site } from '@/lib/site/config';
import { StaticNebula } from '@/components/three/StaticNebula';
import ThreeErrorBoundary from '@/components/three/ThreeErrorBoundary';

// SSR keeps the static sculpture present while the WebGL chunk loads.
const HeroScene = dynamic(() => import('@/components/three/HeroScene'));

export default function Hero() {
  return (
    <section data-nav-theme="dark" className="home-hero">
      <div className="hero-shell site-container">
        <div className="hero-copy">
          <p className="hero-kicker">集智 AI OPC 社区</p>
          <p className="hero-audience">面向 AI 创业团队与「一人公司」</p>
          <h1>集众智之力，<br />启 <span className="hero-ai">AI</span> 未来</h1>
          <p className="hero-description">
            一站式 AI 应用综合赋能平台，为创业者提供空间、算力、技术、培训、流量、订单、企业服务、资本政策全方位的支持。
          </p>
          <div className="hero-actions">
            <ButtonLink href="/apply" size="lg" className="hero-primary">
              申请入驻 <span aria-hidden="true">↗</span>
            </ButtonLink>
            <ButtonLink href="#empower-section" size="lg" variant="light">
              了解八大赋能 <span aria-hidden="true">↓</span>
            </ButtonLink>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <ThreeErrorBoundary fallback={<StaticNebula className="absolute inset-0" />}>
            <HeroScene />
          </ThreeErrorBoundary>
          <span className="hero-art-caption">JIZHI / COLLECTIVE INTELLIGENCE</span>
        </div>
        <dl className="hero-facts">
          <div><dt>社区坐标</dt><dd>北京 · 丰台大红门</dd></div>
          <div><dt>首期空间</dt><dd>{site.area}</dd></div>
          <div><dt>启动运营</dt><dd>{site.launch}</dd></div>
        </dl>
      </div>
    </section>
  );
}
