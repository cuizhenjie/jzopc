'use client';

import { MeshGradient } from '@paper-design/shaders-react';
import { brand } from '@/lib/site/config';
import { ShaderErrorBoundary } from './shader-error-boundary';
import { useReducedMotion } from './use-reduced-motion';

/**
 * 全站 shader 背景层的语义化组件（@paper-design/shaders-react MeshGradient）。
 *
 * 组件化收敛点：所有「大面积氛围背景」需求都从这里取，不再各页面手写 WebGL。
 * 预置变体覆盖已知场景；确需定制时传 colors/速度参数，降级链仍然生效。
 *
 * 降级链（三级）：
 *   1. WebGL 可用 → 动态 MeshGradient；
 *   2. 用户开启「减弱动效」→ speed=0 静止帧；
 *   3. WebGL 初始化失败 → 不渲染 canvas，父容器 CSS 渐变兜底。
 *
 * SSR 输出空 div 占位，不阻塞首屏。
 */

export type ShaderBackdropVariant = 'login' | 'shell' | 'brand';

const VARIANTS: Record<
  string,
  { colors: string[]; speed: number; distortion: number; swirl: number; className: string }
> = {
  /** 登录页：深海军蓝品牌色流动 */
  login: {
    colors: [brand.navy, brand.navyDeep, brand.blue, brand.gradientFrom, brand.teal],
    speed: 0.14,
    distortion: 0.6,
    swirl: 0.4,
    className: 'opacity-100',
  },
  /** 后台内页：极浅底色，压低存在感保证表格可读性 */
  shell: {
    colors: ['#f6f9fc', '#eef4fa', '#ffffff'],
    speed: 0.08,
    distortion: 0.4,
    swirl: 0.2,
    className: 'opacity-70',
  },
  /** 品牌强调：模块页头 / 空状态卡等需要一点「生命感」的浅色场景 */
  brand: {
    colors: [brand.blue, brand.teal, brand.gradientFrom, '#ffffff'],
    speed: 0.1,
    distortion: 0.35,
    swirl: 0.25,
    className: 'opacity-60',
  },
};

export default function ShaderBackdrop({
  variant = 'shell',
  className = '',
}: {
  variant?: ShaderBackdropVariant | string;
  /** 追加到最外层容器的类名（定位交给使用方：absolute inset-0 等） */
  className?: string;
}) {
  const reduced = useReducedMotion();
  const conf = VARIANTS[variant] ?? VARIANTS.shell;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${conf.className} ${className}`}
    >
      <ShaderErrorBoundary>
        <MeshGradient
          colors={conf.colors}
          speed={reduced ? 0 : conf.speed}
          distortion={conf.distortion}
          swirl={conf.swirl}
          className="h-full w-full"
        />
      </ShaderErrorBoundary>
    </div>
  );
}
