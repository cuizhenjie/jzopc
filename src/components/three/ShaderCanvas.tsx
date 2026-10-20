'use client';

import { Canvas, type CanvasProps } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { detectWebGL2, profileDevice, type QualityTier } from './quality';

type ShaderCanvasProps = {
  children: React.ReactNode;
  /** 降级静态内容：品牌渐变 + 静态星点 */
  fallback?: React.ReactNode;
  className?: string;
  quality?: QualityTier;
  dpr?: [number, number];
  /** 是否在视口外暂停渲染 */
  pauseOffscreen?: boolean;
  'aria-hidden'?: boolean;
};

/**
 * r3f Canvas 封装：能力探测 + 质量分级 + 视口暂停 + 卸载清理。
 * 降级链见 docs/02-技术方案.md §7.7。
 */
export default function ShaderCanvas({
  children,
  fallback = null,
  className,
  quality,
  dpr,
  pauseOffscreen = true,
  'aria-hidden': ariaHidden = true,
}: ShaderCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [tier, setTier] = useState<QualityTier>('static');
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const p = profileDevice();
    setTier(quality ?? p.tier);
    setReady(p.hasWebGL2);
  }, [quality]);

  useEffect(() => {
    if (!pauseOffscreen || typeof IntersectionObserver === 'undefined') return;
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '120px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pauseOffscreen]);

  if (!ready) {
    // 首帧不挂 canvas，避免 CLS；fallback 与 canvas 必须等尺寸
    return <div className={clsx('overflow-hidden', className)}>{fallback}</div>;
  }

  if (tier === 'static') {
    return <div className={clsx('overflow-hidden', className)}>{fallback}</div>;
  }

  const canvasProps: CanvasProps = {
    dpr: dpr ?? [1, 1.5],
    frameloop: visible ? 'always' : 'never',
    gl: { antialias: tier === 'high', alpha: true, powerPreference: 'high-performance' },
    camera: { position: [0, 0, 6], fov: 55 },
    // 容器必须撑满包裹层；包裹层自身由 className 决定定位（默认 absolute inset-0）
    style: { position: 'absolute', inset: 0, width: '100%', height: '100%' },
  };

  return (
    <div
      ref={wrapRef}
      className={clsx('overflow-hidden', className ?? 'absolute inset-0')}
      aria-hidden={ariaHidden}
    >
      <Canvas {...canvasProps}>
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </div>
  );
}
