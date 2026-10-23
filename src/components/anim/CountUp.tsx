'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

/**
 * 通用数字滚动（从 HomeFx 的 data-stat-value count-up 提炼）。
 *
 * 设计纪律（与 PageHeroFx / HomeFx / Reveal 一致）：**SSR HTML 输出终值**，
 * 无 JS / 爬虫 / 减弱动效场景下数字完整可读；仅在客户端挂载后、
 * 用户未开启「减弱动效」、且元素进入视口时才播放 0 → 终值的滚动。
 *
 * 数字用等宽数字排版（globals 的 .tnum），滚动过程中宽度不抖动。
 */
function format(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${grouped}.${frac}` : grouped;
}

export default function CountUp({
  value,
  duration = 1.6,
  decimals = 0,
  prefix,
  suffix,
  className,
}: {
  /** 目标数值；SSR 直接渲染它的终值 */
  value: number;
  /** 滚动时长（秒），与首页数据条一致默认 1.6 */
  duration?: number;
  /** 小数位数（0 = 整数） */
  decimals?: number;
  /** 渲染在数字前/后的字面量（如 "%"、"¥"），不参与滚动 */
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const numRef = useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const el = numRef.current;
      if (!el || !Number.isFinite(value)) return;

      const mm = gsap.matchMedia();
      mm.add(
        '(prefers-reduced-motion: no-preference)',
        () => {
          // 进入视口才滚动；挂载时已在视口内则 IO 立即回调
          const io = new IntersectionObserver(
            (entries) => {
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                io.disconnect();
                const counter = { v: 0 };
                gsap.to(counter, {
                  v: value,
                  duration,
                  ease: 'power2.out',
                  onUpdate: () => {
                    el.textContent = format(counter.v, decimals);
                  },
                  onComplete: () => {
                    // 落定终值，避免浮点尾差
                    el.textContent = format(value, decimals);
                  },
                });
              }
            },
            { rootMargin: '0px 0px -10% 0px', threshold: 0 },
          );
          io.observe(el);
          return () => io.disconnect();
        },
        numRef,
      );

      return () => {
        mm.revert();
        // matchMedia 回收不会还原 onUpdate 改过的文本；
        // 依赖变化或降级时确保停在终值，不留中间值
        el.textContent = format(value, decimals);
      };
    },
    { dependencies: [value, duration, decimals], scope: numRef },
  );

  return (
    <span className={className ? `${className} tnum` : 'tnum'} data-count-up="">
      {prefix}
      <span ref={numRef}>{format(value, decimals)}</span>
      {suffix}
    </span>
  );
}
