'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { detectWebGL2, profileDevice, useAdaptiveQuality, type DeviceProfile } from './quality';
import { StaticNebula } from './StaticNebula';
import ThreeErrorBoundary from './ThreeErrorBoundary';

/**
 * 3D 场景客户端壳。
 * `next/dynamic` + `ssr:false` 在 App Router 必须放在 Client Component 里，
 * 因此这里做一层壳，服务端只渲染静态降级背景。
 */
const HeroBackdrop = dynamic(() => import('./HeroBackdrop'), { ssr: false });
const HeroNebula = dynamic(() => import('./HeroNebula'), { ssr: false });
const ShaderCanvas = dynamic(() => import('./ShaderCanvas'), { ssr: false });

export { StaticNebula };

export default function HeroScene() {
  const [mounted, setMounted] = useState(false);
  const [webgl, setWebgl] = useState(false);
  const [count, setCount] = useState(0);
  const [tier, setTier] = useState<string>('static');
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const ok = detectWebGL2();
    setWebgl(ok);
    const p: DeviceProfile = profileDevice();
    setTier(p.tier);
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
    return (
      <div
        className="absolute inset-0"
        data-3d-tier={mounted ? tier : 'pending'}
        data-3d-particles={0}
      >
        <StaticNebula className="absolute inset-0" />
      </div>
    );
  }

  return (
    // data-3d-tier / data-3d-particles：把「当前降级档位与实际粒子数」暴露到 DOM，
    // 使五级降级链可被外部脚本与自动化测试逐级留证（见 docs/06 §4.3）。
    <div
      className="absolute inset-0"
      aria-hidden="true"
      data-3d-tier={tier}
      data-3d-particles={adaptiveCount}
    >
      {/* 第二道防线：3D 任何运行时异常都降级为静态背景，绝不带走首屏内容 */}
      <ThreeErrorBoundary fallback={<StaticNebula className="absolute inset-0" />}>
        <HeroBackdrop />
        <ShaderCanvas
          className="absolute inset-0"
          fallback={<StaticNebula className="absolute inset-0" />}
        >
          <HeroNebula count={adaptiveCount} pointer={pointer} />
        </ShaderCanvas>
      </ThreeErrorBoundary>
    </div>
  );
}
