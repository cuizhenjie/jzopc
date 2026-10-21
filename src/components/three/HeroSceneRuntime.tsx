'use client';

import { useEffect, type RefObject } from 'react';
import HeroBackdrop from './HeroBackdrop';
import HeroNebula from './HeroNebula';
import ShaderCanvas from './ShaderCanvas';
import { useAdaptiveQuality, type DeviceProfile } from './quality';

type RuntimeProps = {
  profile: DeviceProfile;
  active: boolean;
  pointerRef: RefObject<{ x: number; y: number }>;
  onReady: () => void;
  onFailure: () => void;
  onParticleCount: (count: number) => void;
};

/** One WebGL context for the background and sculpture; the outer shell owns lifecycle. */
export default function HeroSceneRuntime({ profile, active, pointerRef, onReady, onFailure, onParticleCount }: RuntimeProps) {
  const count = useAdaptiveQuality(profile.particleCount, active);
  useEffect(() => onParticleCount(count), [count, onParticleCount]);
  return (
    <ShaderCanvas profile={profile} active={active} onReady={onReady} onContextLost={onFailure}>
      <HeroBackdrop />
      <HeroNebula count={count} pointerRef={pointerRef} />
    </ShaderCanvas>
  );
}
