'use client';

import { Component, type ReactNode } from 'react';

/**
 * Shader 层共用的错误边界：WebGL 初始化失败时静默降级。
 * 父容器保留 CSS 渐变兜底（五级降级哲学的收敛版），
 * 任何 shader 组件都不应因环境不支持而把页面带走。
 */
export class ShaderErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.info('[shaders] WebGL 不可用，降级为 CSS 渐变', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
