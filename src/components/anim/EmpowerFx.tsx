'use client';

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * 赋能详情页 GSAP 动效层（模式与 HomeFx / PageHeroFx 一致）。
 *
 * 设计纪律：**SSR HTML 里内容始终可见**，隐藏 → 出现只发生在客户端挂载后、
 * 且用户未开启「减弱动效」时；无 JS / 爬虫 / reduced-motion 场景下页面零差异。
 *
 * 包含：
 * 1. 核心价值 values 卡滚动入场（y + opacity，stagger 0.06；完成后 clearProps
 *    清掉内联 transform，把 hover 的 translateY(-3px) 过渡交还给 CSS）
 * 2. 关键数据 count-up（data-count-value 只放纯数字，SSR 输出终值，
 *    进入视口后从 0 起计，单位/后缀不动 —— 与首页 data-stat-value 同口径）
 */
export default function EmpowerFx({ children }: { children: ReactNode }) {
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
          /* ── 1. values 卡滚动入场 ─────────────────────── */
          if (has('.empower-value-card')) {
            ScrollTrigger.batch(q('.empower-value-card'), {
              start: 'top 88%',
              once: true,
              onEnter: (els) =>
                gsap.from(els, {
                  y: 24,
                  opacity: 0,
                  duration: 0.7,
                  ease: 'power3.out',
                  stagger: 0.06,
                  overwrite: true,
                  clearProps: 'transform,opacity',
                }),
            });
          }

          /* ── 2. 关键数据 count-up ─────────────────────── */
          q('[data-count-value]').forEach((el) => {
            const raw = (el as HTMLElement).dataset.countValue ?? '';
            const target = Number(raw.replace(/,/g, ''));
            if (!Number.isFinite(target) || target === 0) return;
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
        },
        scope,
      );

      return () => mm.revert();
    },
    { scope },
  );

  return (
    <div ref={scope} data-empower-fx="">
      {children}
    </div>
  );
}
