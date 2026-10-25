'use client';

import { useEffect, useState } from 'react';

/**
 * prefers-reduced-motion 时冻结 shader 动画（渲染静止帧而非移除画面）。
 * shader 组件包内共用；SSR 首帧返回 false，与降级链一致。
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
