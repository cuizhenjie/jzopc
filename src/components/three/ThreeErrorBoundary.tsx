'use client';

import { Component, type ReactNode } from 'react';

/**
 * 3D 层的错误边界。
 *
 * ## 为什么必须有它
 *
 * 2026-10-20 实测：在 **WebGL1-only** 环境（禁用 webgl2 上下文）下，
 * three 挂载时抛 `THREE.WebGLRenderer: Error creating WebGL context.`。
 * 该异常沿 React 树向上冒泡，**把整个 Hero 子树一起炸掉**——
 * 首屏的 H1、副标、简介与 CTA 全部消失（实测 `h1Visible: false`）。
 *
 * 也就是说：3D 不仅可能"不好看"，还可能**把内容带走**。
 * 这与 `docs/06` §1.1「任何一条信息都不能只有 3D 形式存在」和
 * §4.3「任何一级降级下，Hero 文案、指标条、CTA 必须完整可见」直接冲突。
 *
 * 严格 WebGL2 探测（`quality.ts`）是第一道防线；本错误边界是第二道 ——
 * 覆盖探测**无法预见**的失败：着色器编译失败、上下文丢失、
 * 驱动黑屏、显存不足、Paper 组件内部异常等。
 */
export default class ThreeErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    // 只记日志，不抛出 —— 让降级静默生效
    console.error('[3d:degraded]', error?.message ?? error);
  }

  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}
