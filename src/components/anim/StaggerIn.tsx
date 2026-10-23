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
 * 让同一批进入视口的卡片按 0.05–0.07s 间隔依次入场（y + opacity，power3.out），
 * 节奏由 GSAP 时间线统一驱动，比逐卡触发更整齐。实现沿用 HomeFx 里
 * ScrollTrigger.batch 的成熟写法。
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
  y = 24,
  stagger = 0.06,
  duration = 0.65,
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

      const mm = gsap.matchMedia();
      mm.add(
        '(prefers-reduced-motion: no-preference)',
        () => {
          ScrollTrigger.batch(items, {
            start,
            once: true,
            onEnter: (els) =>
              gsap.from(els, {
                y,
                opacity: 0,
                duration,
                stagger,
                ease: 'power3.out',
                overwrite: true,
                // 入场完成即清掉内联 transform/opacity：
                // 卡片的 hover:-translate-y-1 等 CSS hover 位移依赖 transform，
                // 残留的内联 transform 会把它们盖掉
                clearProps: 'transform,opacity',
              }),
          });
        },
        scope,
      );

      return () => mm.revert();
    },
    { scope },
  );

  return (
    <div ref={scope} className={className} data-stagger-in="">
      {children}
    </div>
  );
}
