'use client';

import { MeshGradient } from '@paper-design/shaders-react';
import { brand } from '@/lib/site/config';

/**
 * Hero 背景层：Paper Shaders 的 MeshGradient（WebGL/GLSL，零运行时依赖，全库 11.6KB gzip）。
 * 替代手写 FBM 极光层 —— 见 docs/04-shader选型指南.md §7 M3。
 */
export default function HeroBackdrop({ staticMode = false }: { staticMode?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <MeshGradient
        width="100%"
        height="100%"
        colors={[brand.navy, brand.blue, brand.teal, brand.cyan]}
        distortion={0.82}
        swirl={0.16}
        grainMixer={0}
        grainOverlay={0.08}
        speed={staticMode ? 0 : 0.25}
        minPixelRatio={1}
        maxPixelCount={2_000_000}
      />
    </div>
  );
}
