'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AdminIcon } from './shell/AdminIcons';

/**
 * 退出登录按钮（深海军蓝底上的样式）。
 * compact = 折叠侧栏里的图标版：无文字，靠 aria-label / title 提供可访问名。
 */
export default function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/admin/session', { method: 'DELETE' });
    } catch {
      // 即使请求失败也跳登录页（cookie 留着最多再点一次）
    } finally {
      router.replace('/admin/login');
      router.refresh();
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={logout}
        disabled={busy}
        aria-label="退出登录"
        title={busy ? '退出中…' : '退出登录'}
        className="grid h-9 w-9 place-items-center rounded-lg border border-white/25 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
      >
        <AdminIcon name="logOut" className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="rounded-lg border border-white/25 px-3 py-1.5 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
    >
      {busy ? '退出中…' : '退出登录'}
    </button>
  );
}
