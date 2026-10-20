'use client';

import { useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

type Stat = { key: string; value: number; suffix: string; label: string };

function Counter({ value, suffix, reduced }: { value: number; suffix: string; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  // 服务端渲染直接输出最终值（SEO 与无 JS 场景正确），不做从 0 开始
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    // 首次挂载时已经在视口内 → 保持静态最终值，避免「先显示再归零」的闪烁
    if (!inView) {
      setDisplay(0);
      return;
    }
    if (started.current) return;
    started.current = true;

    const duration = 1400;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t); // easeOutExpo
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, reduced]);

  return (
    <span ref={ref} className="tnum">
      {display}
      {suffix}
    </span>
  );
}

export default function StatsBar({ stats }: { stats: readonly Stat[] }) {
  const reduced = useReducedMotion();
  return (
    // 编辑式数据条：每个数字上方一条细线、左对齐。
    // 过去的「四个居中裸数字浮在白底上」是 AI 模板站的典型样貌 —— 数字没有容器、没有分隔，读不出结构。
    <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 sm:gap-8">
      {stats.map((s, i) => (
        <div
          key={s.key}
          className={
            'border-t pt-4 ' +
            // 第一个用品牌色起头，其余用分割线 —— 制造节奏而不是四等分的呆板
            (i === 0 ? 'border-[var(--color-brand-blue-deep)]' : 'border-[var(--color-line)]')
          }
        >
          <p className="text-[34px] font-semibold leading-none tracking-tight text-[var(--color-brand-navy)] sm:text-[44px]">
            <Counter value={s.value} suffix={s.suffix} reduced={Boolean(reduced)} />
          </p>
          <p className="mt-2.5 text-[13px] text-[var(--color-ink-2)] sm:text-sm">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
