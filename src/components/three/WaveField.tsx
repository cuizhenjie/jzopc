'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { profileDevice, type DeviceProfile } from './quality';
import StaticWave from './StaticWave';
import ThreeErrorBoundary from './ThreeErrorBoundary';
import { useSceneActivity } from './useSceneActivity';

// Same lazy discipline as HeroScene: static-tier / reduced-motion / data-saving
// devices never request the second Three.js context (it shares the hero's chunk).
const WaveFieldRuntime = dynamic(() => import('./WaveFieldRuntime'), { ssr: false });

/**
 * 首页「数字海洋」全页 fixed 背景层（openhex wave-grid 的对应物）。
 * 与 Hero 雕塑分工：雕塑是首屏焦点，这片海在 hero 与底部 navy CTA 透出，
 * 白色内容区被实心底遮盖；亮暗节奏由 HomeFx 的 ScrollTrigger 驱动。
 * 仅 desktop high/medium 档创建 WebGL，low/static 档用 CSS 静态海面
 * （移动端维持单 WebGL 上下文给 Hero 雕塑）。
 */
export default function WaveField() {
  const layerRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  // Fixed layer is always in viewport: follow page visibility only.
  const active = useSceneActivity(layerRef, false);
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [deferred, setDeferred] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [failed, setFailed] = useState(false);
  const [painted, setPainted] = useState(false);
  const [points, setPoints] = useState(0);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      const nextProfile = profileDevice();
      setReduceMotion(nextProfile.reducedMotion);
      setProfile(nextProfile);
    };
    updateMotion();
    motionQuery.addEventListener('change', updateMotion);
    return () => motionQuery.removeEventListener('change', updateMotion);
  }, []);

  useEffect(() => {
    if (!profile || reduceMotion || !active || deferred) return;
    let idle = 0;
    let timer = 0;
    let firstFrame = 0;
    let secondFrame = 0;
    let cancelled = false;
    // Defer behind the hero scene's own boot: load + two frames + idle.
    const afterLoad = () => {
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => {
          const ready = () => { if (!cancelled) setDeferred(true); };
          if (typeof window.requestIdleCallback === 'function') {
            idle = window.requestIdleCallback(ready, { timeout: 2200 });
          } else {
            timer = window.setTimeout(ready, 400);
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

  const tier = profile?.tier ?? 'pending';
  // low/static stay on the CSS poster so mobile keeps a single WebGL context.
  const enabled = Boolean(profile && (tier === 'high' || tier === 'medium') && deferred && !reduceMotion && !failed);
  useEffect(() => {
    if (!enabled) setPainted(false);
  }, [enabled]);

  // Ripples only make sense where a precise pointer exists.
  const pointerFine = typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
  useEffect(() => {
    if (!enabled || !active || !pointerFine) return;
    const onPointer = (event: PointerEvent) => {
      pointerRef.current.x = Math.max(-1, Math.min(1, (event.clientX / window.innerWidth) * 2 - 1));
      pointerRef.current.y = Math.max(-1, Math.min(1, 1 - (event.clientY / window.innerHeight) * 2));
    };
    window.addEventListener('pointermove', onPointer, { passive: true });
    return () => window.removeEventListener('pointermove', onPointer);
  }, [enabled, active, pointerFine]);

  const onReady = useCallback(() => setPainted(true), []);
  const onFailure = useCallback(() => setFailed(true), []);

  return (
    <div
      ref={layerRef}
      className="home-wave-layer"
      aria-hidden="true"
      data-wave-tier={failed || reduceMotion ? 'static' : tier === 'low' || tier === 'static' ? 'poster' : tier}
      data-wave-points={enabled ? points : 0}
      data-wave-active={enabled && active ? 'true' : 'false'}
    >
      {/* 入场淡入作用于 inner；滚动亮暗节奏由 HomeFx 作用于外层 —— 两段动画不共写同一属性 */}
      <div className="home-wave-inner">
        <div style={{ position: 'absolute', inset: 0, opacity: painted && enabled ? 0 : 1, transition: reduceMotion ? 'none' : 'opacity 600ms ease' }}>
          <StaticWave className="absolute inset-0" />
        </div>
        {enabled && profile && (
          <ThreeErrorBoundary fallback={null} onFailure={onFailure}>
            <WaveFieldRuntime
              profile={profile}
              active={active}
              pointerRef={pointerRef}
              onReady={onReady}
              onFailure={onFailure}
              onParticleCount={setPoints}
            />
          </ThreeErrorBoundary>
        )}
      </div>
    </div>
  );
}
