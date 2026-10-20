'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * 滚动揭示。
 *
 * 设计原则：**服务端渲染时内容必须可见**。
 * - HTML 里默认 `opacity: 1`（无 JS、无爬虫、JS 加载慢都能正常阅读）；
 * - 客户端挂载后，才给「首屏以下」的区块加上 data-state="pending"，
 *   由 IntersectionObserver 切到 "in" 触发过渡。
 *
 * 这样既保留了动效，又不会让内容依赖 JS 才可见。
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    document.documentElement.classList.add('js-reveal');

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      el.dataset.state = 'in';
      return;
    }

    // 首屏可见区域（含略下方一点）的内容直接显示，不做动画
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.94) {
      el.dataset.state = 'in';
      return;
    }

    el.dataset.state = 'pending';
    el.style.setProperty('--reveal-y', `${y}px`);

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.dataset.state = 'in';
            io.disconnect();
          }
        }
      },
      { rootMargin: '0px 0px -56px 0px', threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [y]);

  return (
    <div
      ref={ref}
      data-reveal=""
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
      className={className}
    >
      {children}
    </div>
  );
}

/** 依次揭示的子元素列表 */
export function Stagger({
  children,
  className,
  step = 0.06,
}: {
  children: ReactNode[];
  className?: string;
  step?: number;
}) {
  // 外层承载布局（如 grid），每个子项由 Reveal 包一层 div 作为 grid item
  return (
    <div className={className}>
      {children.map((c, i) => (
        <Reveal key={i} delay={i * step}>
          {c}
        </Reveal>
      ))}
    </div>
  );
}
