'use client';

import { useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * 列表卡批量入场（GSAP batch stagger）。
 *
 * 用途：替换列表页「每张卡各自一个 Reveal + CSS transition-delay」的逐卡揭示，
 * 同一批卡片的错峰总时长不超过 180ms（y + opacity，power3.out）。
 * 首屏与已获得焦点的卡片保持可见，避免 hydration 后闪隐。
 *
 * 设计纪律（SSR 可见铁律）：**HTML 里所有卡片默认可见**，隐藏 → 出现的
 * `from` 只在滚动触发那一刻、且用户未开启「减弱动效」时发生；无 JS /
 * 爬虫 / reduced-motion 场景下页面零差异。
 *
 * 结构：本组件的包裹 <div> 就是**列表容器**（grid/flex 布局类传给 className），
 * 直接子元素即动画单元（grid item 是子元素本身，不是本组件的包裹层）。
 */
export default function StaggerIn({
  children,
  className,
  y = 16,
  stagger = 0.055,
  duration = 0.54,
  start = 'top 88%',
}: {
  children: ReactNode;
  /** 列表容器布局类（grid gap-4 sm:grid-cols-2 …）；包裹层不另加样式 */
  className?: string;
  /** 入场位移（px） */
  y?: number;
  /** 相邻卡片入场间隔（秒） */
  stagger?: number;
  /** 单卡入场时长（秒） */
  duration?: number;
  /** 滚动触发点，传给 ScrollTrigger.start */
  start?: string;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = scope.current;
      if (!root) return;
      // 动画单元 = 直接子元素（卡片本身），与「包裹层是容器」的结构约定一致
      const items = Array.from(root.children) as HTMLElement[];
      if (items.length === 0) return;
      const entered = new WeakSet<HTMLElement>();
      const onFocus = (event: FocusEvent) => {
        const item = items.find(item => item.contains(event.target as Node));
        if (!item) return;
        entered.add(item);
        // Completing the existing tween creates no new animation or context.
        gsap.getTweensOf(item).forEach(tween => tween.progress(1));
      };
      root.addEventListener('focusin', onFocus);

      const mm = gsap.matchMedia();
      mm.add(
        '(prefers-reduced-motion: no-preference)',
        () => {
          const pending = items.filter(item => !entered.has(item)
            && item.getBoundingClientRect().top > window.innerHeight + 24);
          if (!pending.length) return;
          ScrollTrigger.batch(pending, {
            start,
            once: true,
            onEnter: els => {
              const targets = (els as HTMLElement[]).filter(item => !entered.has(item)
                && !item.contains(document.activeElement));
              (els as HTMLElement[]).forEach(item => entered.add(item));
              if (!targets.length) return;
              gsap.from(targets, {
                y: Number.isFinite(y) ? Math.max(-24, Math.min(24, y)) : 16,
                opacity: 0,
                duration: Number.isFinite(duration) ? Math.max(0.2, Math.min(0.7, duration)) : 0.54,
                stagger: { amount: Number.isFinite(stagger) ? Math.max(0, Math.min(0.18, (targets.length - 1) * stagger)) : 0.18 },
                ease: 'power3.out',
                overwrite: true,
                // 入场完成即清掉内联 transform/opacity：
                // 卡片的 hover:-translate-y-1 等 CSS hover 位移依赖 transform，
                // 残留的内联 transform 会把它们盖掉
                clearProps: 'transform,opacity',
              });
            },
          });
        },
        scope,
      );

      return () => {
        root.removeEventListener('focusin', onFocus);
        mm.revert();
      };
    },
    { scope },
  );

  return (
    <div ref={scope} className={className} data-stagger-in="">
      {children}
    </div>
  );
}
