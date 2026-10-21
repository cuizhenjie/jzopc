'use client';

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/**
 * 内页 masthead 入场动效。
 *
 * PageHero 必须保持静态服务端组件（面包屑 JsonLd / <title> 纪律，
 * 见 PageHero.tsx 顶部注释），所以动效全部收敛在这个客户端包裹层里：
 * SSR 输出完整可见的 HTML，客户端挂载后、未开启「减弱动效」时才播放
 * 隐藏 → 出现的入场时间线；右侧同心环极慢速旋转。
 */
export default function PageHeroFx({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      const q = gsap.utils.selector(root);
      const has = (sel: string) => q(sel).length > 0;

      const mm = gsap.matchMedia();
      mm.add(
        '(prefers-reduced-motion: no-preference)',
        () => {
          const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.08 });
          if (has('.breadcrumbs'))
            tl.from('.breadcrumbs', { y: 12, opacity: 0, duration: 0.5 });
          if (has('.page-hero-eyebrow'))
            tl.from('.page-hero-eyebrow', { y: 12, opacity: 0, duration: 0.45 }, '-=0.3');
          if (has('.page-hero-content h1'))
            tl.from('.page-hero-content h1', { y: 30, opacity: 0, duration: 0.85 }, '-=0.25');
          if (has('.page-hero-description'))
            tl.from('.page-hero-description', { y: 20, opacity: 0, duration: 0.6 }, '-=0.5');
          if (has('.page-hero-extra'))
            tl.from('.page-hero-extra', { y: 18, opacity: 0, duration: 0.55 }, '-=0.4');

          // 同心环 120s 一圈的极慢自转，几乎无感但让画面"活着"
          if (has('.page-hero-art'))
            gsap.to('.page-hero-art', { rotate: '+=360', duration: 120, repeat: -1, ease: 'none' });
        },
        scope,
      );

      return () => mm.revert();
    },
    { scope },
  );

  return (
    <div ref={scope} data-page-hero-fx="">
      {children}
    </div>
  );
}
