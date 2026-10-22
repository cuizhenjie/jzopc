'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Mode = 'account' | 'master';

export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('account');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const payload =
        mode === 'account'
          ? { username: username.trim(), password }
          : { token };
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? '登录失败，请重试。');
        return;
      }
      router.replace('/admin');
      router.refresh();
    } catch {
      setError('网络异常，请重试。');
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    'mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-[15px] text-white outline-none transition-colors placeholder:text-white/40 focus:border-white/50';

  return (
    <form onSubmit={submit} className="mt-8 w-full max-w-sm">
      {mode === 'account' ? (
        <>
          <label htmlFor="admin-username" className="block text-[13px] font-medium text-white/70">
            用户名
          </label>
          <input
            id="admin-username"
            name="username"
            type="text"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="管理员账号"
            className={inputClass}
          />
          <label htmlFor="admin-password" className="mt-4 block text-[13px] font-medium text-white/70">
            密码
          </label>
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="账号密码"
            className={inputClass}
          />
        </>
      ) : (
        <>
          <label htmlFor="admin-token" className="block text-[13px] font-medium text-white/70">
            恢复主口令（OPS_TOKEN）
          </label>
          <input
            id="admin-token"
            name="token"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="仅在忘记账号密码时使用"
            className={inputClass}
          />
          <p className="mt-2 text-[12px] leading-relaxed text-white/50">
            主口令由服务器环境变量 OPS_TOKEN 配置。用主口令登录后建议尽快用
            <code className="mx-1 rounded bg-white/10 px-1 py-0.5">pnpm admin:create</code>
            重置账号密码。
          </p>
        </>
      )}

      {error && (
        <p className="mt-4 rounded-lg bg-red-500/15 px-3.5 py-2.5 text-[13px] text-red-200 ring-1 ring-red-400/30">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={
          busy || (mode === 'account' ? !username.trim() || !password : !token.trim())
        }
        className="mt-6 w-full rounded-xl bg-white px-4 py-3 text-[14px] font-semibold text-[var(--color-brand-navy)] transition-colors hover:bg-white/90 disabled:opacity-50"
      >
        {busy ? '验证中…' : mode === 'account' ? '登录' : '使用主口令登录'}
      </button>

      <button
        type="button"
        onClick={() => switchMode(mode === 'account' ? 'master' : 'account')}
        className="mt-4 w-full text-center text-[12px] text-white/50 transition-colors hover:text-white/80"
      >
        {mode === 'account' ? '忘记账号密码？使用恢复主口令 →' : '← 返回账号登录'}
      </button>
    </form>
  );
}
