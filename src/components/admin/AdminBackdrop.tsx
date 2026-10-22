'use client';

import { Component, useEffect, useState, type ReactNode } from 'react';
import { MeshGradient } from '@paper-design/shaders-react';
import { brand } from '@/lib/site/config';

/**
 * 管理后台的 shader 背景层（全后台共用的视觉基元，组件化收敛于此）。
 *
 * 技术选型：@paper-design/shaders-react 的 MeshGradient（README 决策表预留的
 * 「背景层用 Paper MeshGradient」路线，~11.6KB gzip，远轻于 three.js）。
 *
 * 降级链（沿用站内「五级降级」哲学，这里收成三级）：
 *   1. WebGL 可用 → 动态 MeshGradient（极慢速流动）；
 *   2. 用户开启「减弱动效」→ speed=0 的静止帧（画面仍在，只是不动）；
 *   3. WebGL 初始化失败（错误边界捕获）→ 不渲染 canvas，
 *      父容器的 CSS 渐变兜底显示 —— 登录页/后台页在任何环境都成立。
 *
 * 服务端渲染时 MeshGradient 输出空 div 占位，不阻塞首屏（HTML 完整可见）。
 */

/** WebGL 初始化失败时静默降级（CSS 渐变在父容器上）。 */
class BackdropErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.info('[admin-backdrop] shader 降级为 CSS 渐变', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export type AdminBackdropVariant = 'login' | 'shell';

const VARIANTS: Record<
  AdminBackdropVariant,
  { colors: string[]; speed: number; distortion: number; swirl: number; className: string }
> = {
  // 登录页：深海军蓝为主的品牌色流动（navy / navyDeep / blue / 青色点缀）
  login: {
    colors: [brand.navy, brand.navyDeep, brand.blue, brand.gradientFrom, brand.teal],
    speed: 0.14,
    distortion: 0.6,
    swirl: 0.4,
    className: 'opacity-100',
  },
  // 后台内页：极浅底色（--color-surface / --color-surface-2 / 纯白，均为既有 token 值）
  // 压低存在感，保证表格可读性
  shell: {
    colors: ['#f6f9fc', '#eef4fa', '#ffffff'],
    speed: 0.08,
    distortion: 0.4,
    swirl: 0.2,
    className: 'opacity-70',
  },
};

/** prefers-reduced-motion 时冻结动画（渲染静止帧而非移除画面）。 */
function useReducedMotion(): boolean {
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

export default function AdminBackdrop({ variant }: { variant: AdminBackdropVariant }) {
  const reduced = useReducedMotion();
  const conf = VARIANTS[variant];

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${conf.className}`}
    >
      <BackdropErrorBoundary>
        <MeshGradient
          colors={conf.colors}
          speed={reduced ? 0 : conf.speed}
          distortion={conf.distortion}
          swirl={conf.swirl}
          className="h-full w-full"
        />
      </BackdropErrorBoundary>
    </div>
  );
}
