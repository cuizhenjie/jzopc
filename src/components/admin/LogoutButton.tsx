'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
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
