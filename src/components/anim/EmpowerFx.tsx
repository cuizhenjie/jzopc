'use client';

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * 赋能详情页的有限入场与数字动效。
 *
 * 设计纪律：**SSR HTML 里内容始终可见**，隐藏 → 出现只发生在客户端挂载后、
 * 且用户未开启「减弱动效」时；无 JS / 爬虫 / reduced-motion 场景下页面零差异。
 *
 * 包含：
 * 1. 只让首屏下方的核心价值卡滚动入场，错峰总时长不超过 180ms。
 *    完成后清掉内联 transform，将交互反馈交还给 CSS。
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
      const cards = q('.empower-value-card') as HTMLElement[];
      const counters = (q('[data-count-value]') as HTMLElement[]).map(el => ({ el, finalText: el.textContent }));
      const entered = new WeakSet<HTMLElement>();
      const counted = new WeakSet<HTMLElement>();
      const restoreCounts = () => {
        counters.forEach(({ el, finalText }) => { el.textContent = finalText; });
      };
      const onFocus = (event: FocusEvent) => {
        const card = cards.find(item => item.contains(event.target as Node));
        if (!card) return;
        entered.add(card);
        gsap.getTweensOf(card).forEach(tween => tween.progress(1));
      };
      root.addEventListener('focusin', onFocus);

      const mm = gsap.matchMedia();

      mm.add(
        '(prefers-reduced-motion: no-preference)',
        () => {
          /* ── 1. values 卡滚动入场 ─────────────────────── */
          const pendingCards = cards.filter(card => !entered.has(card)
            && card.getBoundingClientRect().top > window.innerHeight + 24);
          if (pendingCards.length) {
            ScrollTrigger.batch(pendingCards, {
              start: 'top 88%',
              once: true,
              onEnter: els => {
                const targets = (els as HTMLElement[]).filter(card => !entered.has(card)
                  && !card.contains(document.activeElement));
                (els as HTMLElement[]).forEach(card => entered.add(card));
                if (!targets.length) return;
                gsap.from(targets, {
                  y: 16,
                  opacity: 0,
                  duration: 0.54,
                  ease: 'power3.out',
                  stagger: { amount: Math.min(0.18, (targets.length - 1) * 0.055) },
                  overwrite: true,
                  clearProps: 'transform,opacity',
                });
              },
            });
          }

          /* ── 2. 关键数据 count-up ─────────────────────── */
          counters.forEach(({ el, finalText }) => {
            if (counted.has(el) || el.getBoundingClientRect().top <= window.innerHeight + 24) return;
            const raw = el.dataset.countValue ?? '';
            const target = Number(raw.replace(/,/g, ''));
            if (!Number.isFinite(target) || target === 0) return;
            ScrollTrigger.create({
              trigger: el,
              start: 'top 88%',
              once: true,
              onEnter: () => {
                counted.add(el);
                const counter = { v: 0 };
                gsap.to(counter, {
                  v: target,
                  duration: 1.1,
                  ease: 'power2.out',
                  onUpdate: () => {
                    el.textContent = String(Math.round(counter.v));
                  },
                  onComplete: () => { el.textContent = finalText; },
                });
              },
            });
          });

          // GSAP restores animated properties, but not text written by onUpdate.
          return restoreCounts;
        },
        scope,
      );

      return () => {
        root.removeEventListener('focusin', onFocus);
        mm.revert();
        restoreCounts();
      };
    },
    { scope },
  );

  return (
    <div ref={scope} data-empower-fx="">
      {children}
    </div>
  );
}
