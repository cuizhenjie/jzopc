'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { mountReveal } from './reveal-controller';

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
  y = 16,
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
    return mountReveal(el, y);
  }, [y]);

  const boundedDelay = Number.isFinite(delay) ? Math.max(0, Math.min(0.18, delay)) : 0;

  return (
    // ⚠️ 这个包裹 <div> 就是**真正的 grid item**。
    //    跨列 / 跨行 / 网格定位类（`col-span-*`、`row-span-*` 等）必须传给 `className`
    //    挂在这里，**不能**写在里面的 <Link> 上 —— 那样类存在但对布局完全无效。
    //    （2026-10-20 实测踩过：首页与动态页的 featured 卡写成 `lg:col-span-2`，
    //      结果首条卡与其余卡一样宽，跨列从未生效。）
    <div
      ref={ref}
      data-reveal=""
      style={boundedDelay ? { '--reveal-delay': `${boundedDelay}s` } as CSSProperties : undefined}
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
  const boundedStep = Number.isFinite(step)
    ? Math.max(0, Math.min(step, 0.18 / Math.max(1, children.length - 1)))
    : 0;
  // 外层承载布局（如 grid），每个子项由 Reveal 包一层 div 作为 grid item
  return (
    <div className={className}>
      {children.map((c, i) => (
        <Reveal key={i} delay={i * boundedStep}>
          {c}
        </Reveal>
      ))}
    </div>
  );
}
