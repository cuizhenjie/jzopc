'use client';

import { MeshGradient } from '@paper-design/shaders-react';
import { brand } from '@/lib/site/config';
import { ShaderErrorBoundary } from './shader-error-boundary';
import { useReducedMotion } from './use-reduced-motion';

/**
 * 小型 shader 装饰原语：页面头部的渐变强调条（h-2 圆角横带）。
 *
 * 与 ShaderBackdrop 的分工：
 *   - Backdrop 管大面积氛围背景（登录页 / 外壳）；
 *   - Accent 管小尺度点缀（模块页头、卡片顶边），把 shader「组件化」
 *     落到每个管理页面上，而非只在背景层。
 *
 * 同样三级降级：WebGL → 动效冻结 → CSS 渐变（style 上的 linear-gradient 兜底，
 * shader 挂载前/失败后横带依然有色，不会白条）。
 */
export default function ShaderAccent({
  variant = 'brand',
  className = '',
}: {
  variant?: 'brand' | 'mint' | 'navy';
  className?: string;
}) {
  const reduced = useReducedMotion();

  const colors =
    variant === 'navy'
      ? [brand.navy, brand.navyDeep, brand.blue]
      : variant === 'mint'
        ? [brand.teal, brand.gradientFrom, '#ffffff']
        : [brand.blue, brand.teal, brand.gradientFrom];

  const fallback = `linear-gradient(90deg, ${colors[0]}, ${colors[1]}, ${colors[colors.length - 1]})`;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none h-2 w-full overflow-hidden rounded-full ${className}`}
      style={{ background: fallback }}
    >
      <ShaderErrorBoundary>
        <MeshGradient
          colors={colors}
          speed={reduced ? 0 : 0.12}
          distortion={0.25}
          swirl={0.3}
          className="h-full w-full"
        />
      </ShaderErrorBoundary>
    </div>
  );
}
