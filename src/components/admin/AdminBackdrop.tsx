'use client';

import ShaderBackdrop from '@/components/shaders/ShaderBackdrop';

/**
 * 管理后台 shader 背景层（历史兼容出口）。
 *
 * 实现已组件化收敛到 src/components/shaders（ShaderBackdrop），
 * 这里只保留旧引用路径的转发，登录页 / AdminShell 无需改动。
 */
export type AdminBackdropVariant = 'login' | 'shell';

export default function AdminBackdrop({ variant }: { variant: AdminBackdropVariant }) {
  return <ShaderBackdrop variant={variant} />;
}
