'use client';

import dynamic from 'next/dynamic';
import { ButtonLink } from '@/components/ui/Button';
import { site } from '@/lib/site/config';

const HeroScene = dynamic(() => import('@/components/three/HeroScene'), { ssr: false });

export default function Hero() {
  return (
    <section
      data-nav-theme="dark"
      className="relative isolate min-h-[620px] overflow-hidden bg-[var(--color-brand-navy)] sm:min-h-[720px] lg:min-h-[760px]"
    >
      {/* 3D 背景层：粒子 + MeshGradient，任何降级级别下都保证信息不丢失 */}
      <HeroScene />

      {/* 文案区暗部：保证首屏文字对比度，同时把粒子让到右侧 */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(100deg, rgba(10,37,71,.96) 0%, rgba(10,37,71,.88) 34%, rgba(10,37,71,.45) 58%, rgba(10,37,71,0) 78%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
        aria-hidden="true"
        style={{ background: 'linear-gradient(to top, rgba(255,255,255,.96), transparent)' }}
      />

      <div className="relative mx-auto flex min-h-[620px] w-full max-w-[1240px] flex-col justify-center px-5 pb-20 pt-32 sm:min-h-[720px] sm:px-8 sm:pt-36 lg:min-h-[760px]">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[12px] font-medium tracking-wide text-white/85 ring-1 ring-white/20 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-brand-teal)]" />
            {site.launch}
          </p>

          <h1 className="mt-7 text-[38px] font-semibold leading-[1.12] tracking-tight text-white sm:text-[56px] lg:text-[64px]">
            集智 AI OPC 社区
          </h1>

          <p className="mt-4 text-[20px] font-medium tracking-wide text-[var(--color-brand-cyan)] sm:text-[26px]">
            集众智之力，启 AI 未来
          </p>

          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-white/75 sm:text-[17px]">
            一站式 AI 应用综合赋能平台，为创业者提供空间、算力、技术、培训、流量、订单、企业服务、资本政策全方位的支持。
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3.5">
            <ButtonLink
              href="/apply"
              size="lg"
              className="!bg-white !text-[var(--color-brand-navy)] shadow-[0_14px_36px_-14px_rgba(0,0,0,.55)] hover:!bg-[var(--color-brand-teal)] hover:!text-white"
            >
              申请入驻
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ButtonLink>
            <ButtonLink href="/#empower" size="lg" variant="light">
              了解八大赋能
            </ButtonLink>
          </div>
        </div>
      </div>

    </section>
  );
}
