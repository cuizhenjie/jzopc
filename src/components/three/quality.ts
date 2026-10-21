'use client';

import { useEffect, useState } from 'react';

export type QualityTier = 'high' | 'medium' | 'low' | 'static';

export type DeviceProfile = {
  tier: QualityTier;
  dpr: [number, number];
  particleCount: number;
  hasWebGL2: boolean;
  /** 诊断用：设备是否至少支持 WebGL1（three 需 WebGL2） */
  hasWebGL1: boolean;
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

/**
 * WebGL2 能力探测。
 *
 * ⚠️ 必须是**严格的 WebGL2**，不能把 WebGL1 也算作可用：
 *   - three r163 起移除了 WebGL1 支持（`WebGL1Renderer` 已删除），
 *     构建产物里只剩一句 `const contextName = 'webgl2';`（实测 three@0.169.0）；
 *   - Paper Shaders 同样是 GLSL ES 3.00（WebGL2）。
 *
 * 之前这里写的是 `getContext('webgl2') ?? getContext('webgl')`，
 * 于是 **WebGL1-only 设备会被判为可用** → 挂载 three →
 * `THREE.WebGLRenderer: Error creating WebGL context.` 未捕获异常
 * → 整个 Hero 子树（含 H1 与 CTA）一起被炸掉。
 * 实测证据见 docs/06 §4.3。
 */
export function detectWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    const supported = Boolean(context);
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return supported;
  } catch {
    return false;
  }
}

/** 仅供诊断：设备是否至少支持 WebGL1（three 已用不上，但可判断是否为老旧设备） */
export function detectWebGL1(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl');
    const supported = Boolean(context);
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return supported;
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
      hasWebGL1: false,
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
  const hasWebGL1 = hasWebGL2 || detectWebGL1();

  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.5);

  let tier: QualityTier;
  // 无 WebGL2（含只有 WebGL1 的老旧设备）→ 直接静态档
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
    hasWebGL1,
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
export function useAdaptiveQuality(baseCount: number, active = true): number {
  const [count, setCount] = useState(baseCount);

  useEffect(() => {
    if (baseCount <= 0 || !active) return;
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
  }, [baseCount, active]);

  useEffect(() => {
    setCount(baseCount);
  }, [baseCount]);

  return count;
}
