'use client';

import { useEffect, type RefObject } from 'react';
import ShaderCanvas from './ShaderCanvas';
import WaveGrid from './WaveGrid';
import { useAdaptiveQuality, type DeviceProfile } from './quality';

type RuntimeProps = {
  profile: DeviceProfile;
  active: boolean;
  pointerRef: RefObject<{ x: number; y: number }>;
  onReady: () => void;
  onFailure: () => void;
  onParticleCount: (count: number) => void;
};

/** Second WebGL context: only desktop tiers reach this boundary (mobile keeps one for the hero). */
export default function WaveFieldRuntime({ profile, active, pointerRef, onReady, onFailure, onParticleCount }: RuntimeProps) {
  const base = useAdaptiveQuality(profile.particleCount, active);
  // 海面点阵比雕塑需要更密的网格才成「面」；在自适应结果上放大，不动共享档位表
  const count = Math.round(base * 1.8);
  useEffect(() => onParticleCount(count), [count, onParticleCount]);
  return (
    <ShaderCanvas
      profile={profile}
      active={active}
      onReady={onReady}
      onContextLost={onFailure}
      cameraProps={{ position: [0, 5.4, 9.2], fov: 50, near: 0.5, far: 30 }}
    >
      <WaveGrid count={count} pointerRef={pointerRef} />
    </ShaderCanvas>
  );
}
