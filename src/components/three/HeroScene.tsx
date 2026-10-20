'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { detectWebGL2, profileDevice, useAdaptiveQuality } from './quality';

/**
 * 3D 场景客户端壳。
 * `next/dynamic` + `ssr:false` 在 App Router 必须放在 Client Component 里，
 * 因此这里做一层壳，服务端只渲染静态降级背景。
 */
const HeroBackdrop = dynamic(() => import('./HeroBackdrop'), { ssr: false });
const HeroNebula = dynamic(() => import('./HeroNebula'), { ssr: false });
const ShaderCanvas = dynamic(() => import('./ShaderCanvas'), { ssr: false });

/** 静态降级：品牌渐变 + 星点，任何降级级别下信息都不丢失 */
export function StaticNebula({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 18%, #1D7FBA 0%, #142F59 42%, #0E3769 72%, #0A2547 100%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'radial-gradient(1.6px 1.6px at 18% 26%, rgba(255,255,255,.85), transparent 60%),' +
            'radial-gradient(1.2px 1.2px at 72% 18%, rgba(255,255,255,.65), transparent 60%),' +
            'radial-gradient(1.8px 1.8px at 84% 62%, rgba(87,182,165,.8), transparent 60%),' +
            'radial-gradient(1.1px 1.1px at 32% 74%, rgba(255,255,255,.55), transparent 60%),' +
            'radial-gradient(1.4px 1.4px at 52% 44%, rgba(26,168,211,.75), transparent 60%),' +
            'radial-gradient(1px 1px at 8% 58%, rgba(255,255,255,.45), transparent 60%)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: 'linear-gradient(to top, rgba(10,37,71,.92), transparent)' }}
      />
    </div>
  );
}

export default function HeroScene() {
  const [mounted, setMounted] = useState(false);
  const [webgl, setWebgl] = useState(false);
  const [count, setCount] = useState(0);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const ok = detectWebGL2();
    setWebgl(ok);
    const p = profileDevice();
    setCount(p.tier === 'static' ? 0 : p.particleCount);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !webgl) return;
    const onMove = (e: PointerEvent) => {
      setPointer({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -((e.clientY / window.innerHeight) * 2 - 1),
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [mounted, webgl]);

  const adaptiveCount = useAdaptiveQuality(count);

  if (!mounted || !webgl || count === 0) {
    return <StaticNebula className="absolute inset-0" />;
  }

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <HeroBackdrop />
      <ShaderCanvas className="absolute inset-0" fallback={<StaticNebula className="absolute inset-0" />}>
        <HeroNebula count={adaptiveCount} pointer={pointer} />
      </ShaderCanvas>
    </div>
  );
}
