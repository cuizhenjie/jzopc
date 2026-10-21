'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { profileDevice, type DeviceProfile } from './quality';
import { StaticNebula } from './StaticNebula';
import ThreeErrorBoundary from './ThreeErrorBoundary';
import { useSceneActivity } from './useSceneActivity';

// This is the only lazy boundary: reduced motion / data saving never request Three.js.
const HeroSceneRuntime = dynamic(() => import('./HeroSceneRuntime'), { ssr: false });

export { StaticNebula };

export default function HeroScene() {
  const shellRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const active = useSceneActivity(shellRef);
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [deferred, setDeferred] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [failed, setFailed] = useState(false);
  const [painted, setPainted] = useState(false);
  const [particles, setParticles] = useState(0);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      // Reprofile only on an explicit preference change, so switching motion
      // back on can restore the device's original quality tier.
      const nextProfile = profileDevice();
      setReduceMotion(nextProfile.reducedMotion);
      setProfile(nextProfile);
    };
    updateMotion();
    motionQuery.addEventListener('change', updateMotion);
    // The capability snapshot is shared; the Canvas never probes separately.
    return () => motionQuery.removeEventListener('change', updateMotion);
  }, []);

  useEffect(() => {
    if (!profile || profile.tier === 'static' || reduceMotion || !active || deferred) return;
    let idle = 0;
    let timer = 0;
    let firstFrame = 0;
    let secondFrame = 0;
    let cancelled = false;
    // Let the SSR text, logo and layout paint, then wait for browser idle time.
    const afterLoad = () => {
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          const ready = () => { if (!cancelled) setDeferred(true); };
          if (typeof window.requestIdleCallback === 'function') {
            idle = window.requestIdleCallback(ready, { timeout: 1800 });
          } else {
            timer = window.setTimeout(ready, 250);
          }
        });
      });
    };
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', afterLoad);
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
    };
  }, [profile, reduceMotion, active, deferred]);

  const enabled = Boolean(profile && profile.tier !== 'static' && deferred && !reduceMotion && !failed);
  useEffect(() => {
    if (!enabled) setPainted(false);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !active || !window.matchMedia('(pointer: fine)').matches) return;
    const onPointer = (event: PointerEvent) => {
      const bounds = shellRef.current?.getBoundingClientRect();
      if (!bounds) return;
      pointerRef.current.x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width) * 2 - 1));
      pointerRef.current.y = Math.max(-1, Math.min(1, 1 - ((event.clientY - bounds.top) / bounds.height) * 2));
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => window.removeEventListener('pointermove', onPointer);
  }, [enabled, active]);

  const onReady = useCallback(() => setPainted(true), []);
  const onFailure = useCallback(() => setFailed(true), []);
  const tier = failed || reduceMotion ? 'static' : profile?.tier ?? 'pending';

  return (
    <div
      ref={shellRef}
      className="absolute inset-0"
      aria-hidden="true"
      data-3d-tier={tier}
      data-3d-particles={enabled ? particles : 0}
      data-scene-active={enabled && active ? 'true' : 'false'}
    >
      <div style={{ position: 'absolute', inset: 0, opacity: painted && enabled ? 0 : 1, transition: reduceMotion ? 'none' : 'opacity 450ms ease' }}>
        <StaticNebula className="absolute inset-0" />
      </div>
      {enabled && profile && (
        <ThreeErrorBoundary fallback={null} onFailure={onFailure}>
          <HeroSceneRuntime
            profile={profile}
            active={active}
            pointerRef={pointerRef}
            onReady={onReady}
            onFailure={onFailure}
            onParticleCount={setParticles}
          />
        </ThreeErrorBoundary>
      )}
    </div>
  );
}
