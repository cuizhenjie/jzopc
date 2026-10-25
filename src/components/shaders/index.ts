/**
 * shaders 组件包（@paper-design/shaders-react 的语义化封装）。
 *
 * 使用约定：
 *   - 大面积氛围背景 → <ShaderBackdrop variant="login|shell|brand" />
 *   - 页头 / 卡片点缀 → <ShaderAccent variant="brand|mint|navy" />
 *   - 降级链（WebGL → 减弱动效 → CSS 渐变）已内建，使用方只需保证
 *     父容器有兜底底色。
 */
export { default as ShaderBackdrop } from './ShaderBackdrop';
export type { ShaderBackdropVariant } from './ShaderBackdrop';
export { default as ShaderAccent } from './ShaderAccent';
export { ShaderErrorBoundary } from './shader-error-boundary';
export { useReducedMotion } from './use-reduced-motion';
