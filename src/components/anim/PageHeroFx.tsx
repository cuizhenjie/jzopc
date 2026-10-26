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
 * SSR 输出完整可见的 HTML。客户端挂载后，仅使用轻微位移引导视线，
 * 不重新隐藏首屏正文；开启「减弱动效」时保持静止。
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
          const tl = gsap.timeline({ defaults: { ease: 'power3.out', clearProps: 'transform' } });
          if (has('.breadcrumbs'))
            tl.from('.breadcrumbs', { y: 8, duration: 0.36 });
          if (has('.page-hero-eyebrow'))
            tl.from('.page-hero-eyebrow', { y: 8, duration: 0.4 }, '-=0.28');
          if (has('.page-hero-content h1'))
            tl.from('.page-hero-content h1', { y: 14, duration: 0.58 }, '-=0.32');
          if (has('.page-hero-description'))
            tl.from('.page-hero-description', { y: 12, duration: 0.5 }, '-=0.46');
          if (has('.page-hero-extra'))
            tl.from('.page-hero-extra', { y: 10, duration: 0.46 }, '-=0.38');
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
