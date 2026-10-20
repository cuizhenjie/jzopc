'use client';

import { useEffect, useState } from 'react';

export type QualityTier = 'high' | 'medium' | 'low' | 'static';

export type DeviceProfile = {
  tier: QualityTier;
  dpr: [number, number];
  particleCount: number;
  hasWebGL2: boolean;
  reducedMotion: boolean;
  saveData: boolean;
  deviceMemory: number;
};

const PARTICLE_COUNT: Record<QualityTier, number> = {
  high: 12000,
  medium: 6000,
  low: 2500,
  static: 0,
};

/** WebGL2 能力探测（Paper Shaders 与 three 都需要 WebGL 上下文） */
export function detectWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      (canvas.getContext('webgl') as WebGLRenderingContext | null);
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** 设备分级：见 docs/02-技术方案.md §7.2 */
export function profileDevice(): DeviceProfile {
  if (typeof window === 'undefined') {
    return {
      tier: 'static',
      dpr: [1, 1],
      particleCount: 0,
      hasWebGL2: false,
      reducedMotion: true,
      saveData: false,
      deviceMemory: 4,
    };
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const conn = (
    navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
  ).connection;
  const saveData = Boolean(conn?.saveData);
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const hasWebGL2 = detectWebGL2();

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.5);

  let tier: QualityTier;
  if (!hasWebGL2) tier = 'static';
  else if (reducedMotion || saveData || deviceMemory <= 2) tier = 'static';
  else if (isMobile || deviceMemory <= 4) tier = 'low';
  else if (conn?.effectiveType === '3g' || conn?.effectiveType === '2g') tier = 'medium';
  else tier = 'high';

  return {
    tier,
    dpr: [1, dpr] as [number, number],
    particleCount: PARTICLE_COUNT[tier],
    hasWebGL2,
    reducedMotion,
    saveData,
    deviceMemory,
  };
}

/** 客户端设备画像；SSR 阶段返回 null，避免水合不一致 */
export function useDeviceProfile(): DeviceProfile | null {
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  useEffect(() => {
    setProfile(profileDevice());
  }, []);
  return profile;
}

/**
 * 帧率自适应：连续采样，若平均帧率过低则降低粒子数。
 * 见 docs/02-技术方案.md §7.2 职责 3。
 */
export function useAdaptiveQuality(baseCount: number): number {
  const [count, setCount] = useState(baseCount);

  useEffect(() => {
    if (baseCount <= 0) return;
    let frames = 0;
    let start = performance.now();
    let raf = 0;

    const tick = () => {
      frames += 1;
      const now = performance.now();
      if (now - start >= 1500) {
        const fps = (frames * 1000) / (now - start);
        if (fps < 45) {
          setCount((c) => {
            const next = Math.max(2000, Math.floor(c * 0.6));
            return next;
          });
        }
        frames = 0;
        start = now;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [baseCount]);

  useEffect(() => {
    setCount(baseCount);
  }, [baseCount]);

  return count;
}
