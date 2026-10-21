'use client';

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * 首页 GSAP 动效层。
 *
 * 设计纪律（与 Reveal.tsx 一致）：**SSR HTML 里内容始终可见**，
 * 所有隐藏 → 出现的 `from` 动效只发生在客户端挂载后、且用户未开启
 * 「减弱动效」时；无 JS / 爬虫 / reduced-motion 场景下页面零差异。
 *
 * 包含：
 * 1. Hero 入场时间线（kicker → 标题 → 描述 → 按钮 → 数据条 → 3D 场景淡入）
 * 2. Hero 指针视差 + 滚动视差（3D 星球随指针漂移、随滚动远离）
 * 3. 各区块滚动揭示（标题组 / 服务列表 / 编辑列表 / 合作伙伴 / 新闻）
 * 4. 数据条数字滚动（data-stat-value，SSR 输出终值，滚动到后从 0 计起）
 */
export default function HomeFx({ children }: { children: ReactNode }) {
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
          /* ── 1. Hero 入场 ─────────────────────────────── */
          const tl = gsap.timeline({
            defaults: { ease: 'power3.out' },
            delay: 0.1,
          });
          if (has('.hero-kicker'))
            tl.from('.hero-kicker', { y: 16, opacity: 0, duration: 0.55 });
          if (has('.hero-audience'))
            tl.from('.hero-audience', { y: 12, opacity: 0, duration: 0.5 }, '-=0.35');
          if (has('.hero-copy h1'))
            tl.from('.hero-copy h1', { y: 42, opacity: 0, duration: 1 }, '-=0.25');
          if (has('.hero-description'))
            tl.from('.hero-description', { y: 22, opacity: 0, duration: 0.7 }, '-=0.6');
          if (has('.hero-actions > a'))
            tl.from(
              '.hero-actions > a',
              { y: 18, opacity: 0, duration: 0.55, stagger: 0.09 },
              '-=0.45',
            );
          if (has('.hero-art'))
            tl.from(
              '.hero-art',
              { opacity: 0, scale: 0.92, duration: 1.4, ease: 'power2.out' },
              0.15,
            );
          if (has('.hero-facts > div'))
            tl.from(
              '.hero-facts > div',
              { y: 16, opacity: 0, duration: 0.5, stagger: 0.08 },
              '-=1',
            );

          /* ── 2. Hero 视差 ─────────────────────────────── */
          // 滚动：3D 星球下沉淡出，文案轻微上移，拉出纵深
          if (has('.hero-art') && has('.home-hero')) {
            gsap.to('.hero-art', {
              yPercent: 14,
              opacity: 0.25,
              ease: 'none',
              scrollTrigger: {
                trigger: '.home-hero',
                start: 'top top',
                end: 'bottom top',
                scrub: true,
              },
            });
            gsap.to('.hero-copy', {
              y: -28,
              ease: 'none',
              scrollTrigger: {
                trigger: '.home-hero',
                start: 'top top',
                end: 'bottom top',
                scrub: true,
              },
            });
          }

          // 指针：仅精确指针设备（鼠标/触控板），quickTo 平滑跟随
          let removePointer: (() => void) | undefined;
          const art = q('.hero-art')[0];
          if (art && window.matchMedia('(pointer: fine)').matches) {
            const xTo = gsap.quickTo(art, 'x', { duration: 0.9, ease: 'power3.out' });
            const yTo = gsap.quickTo(art, 'y', { duration: 0.9, ease: 'power3.out' });
            const onMove = (event: PointerEvent) => {
              xTo((event.clientX / window.innerWidth - 0.5) * 22);
              yTo((event.clientY / window.innerHeight - 0.5) * 14);
            };
            window.addEventListener('pointermove', onMove, { passive: true });
            removePointer = () => window.removeEventListener('pointermove', onMove);
          }

          /* ── 3. 区块滚动揭示 ──────────────────────────── */
          const rise = (sel: string, y = 32) => {
                if (!has(sel)) return;
            q(sel).forEach((el) => {
              gsap.from(el, {
                y,
                opacity: 0,
                duration: 0.9,
                ease: 'power3.out',
                scrollTrigger: { trigger: el, start: 'top 85%', once: true },
              });
            });
          };
          rise('.section-intro');
          rise('.community-intro');
          rise('.news-heading');
          rise('.vision-block');
          rise('.advantage-block');
          rise('.cta-layout > div', 26);
          rise('.partners-heading', 22);

          const batch = (sel: string, vars: gsap.TweenVars) => {
            if (!has(sel)) return;
            ScrollTrigger.batch(q(sel), {
              start: 'top 88%',
              once: true,
              onEnter: (els) =>
                gsap.from(els, { ease: 'power3.out', overwrite: true, ...vars }),
            });
          };
          batch('.service-list > li', { y: 28, opacity: 0, duration: 0.7, stagger: 0.07 });
          batch('.editorial-list li', { y: 14, opacity: 0, duration: 0.5, stagger: 0.05 });
          batch('.partner-wordmarks li', { y: 18, opacity: 0, duration: 0.6, stagger: 0.05 });
          batch('.support-link', { y: 16, opacity: 0, duration: 0.5, stagger: 0.06 });
          batch('.news-row', { y: 22, opacity: 0, duration: 0.65, stagger: 0.08 });

          /* ── 4. 数据条数字滚动 ────────────────────────── */
          // SSR 已输出终值（无 JS 可读）；触发后从 0 计到终值。
          q('[data-stat-value]').forEach((el) => {
            const target = Number((el as HTMLElement).dataset.statValue);
            if (!Number.isFinite(target)) return;
            ScrollTrigger.create({
              trigger: el,
              start: 'top 88%',
              once: true,
              onEnter: () => {
                const counter = { v: 0 };
                gsap.to(counter, {
                  v: target,
                  duration: 1.6,
                  ease: 'power2.out',
                  onUpdate: () => {
                    el.textContent = String(Math.round(counter.v));
                  },
                });
              },
            });
          });

          return () => removePointer?.();
        },
        scope,
      );

      return () => mm.revert();
    },
    { scope },
  );

  return (
    <div ref={scope} data-home-fx="">
      {children}
    </div>
  );
}
