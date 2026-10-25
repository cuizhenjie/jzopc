'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminAccountRow } from '@/lib/admin/resources';

/**
 * 管理员账号管理器：列表 + 新建 + 改显示名 / 重置密码 / 启停 / 删除。
 * 服务端 API 带「不能操作自己 / 不能动最后一个启用账号」守卫，前端同样禁用对应按钮。
 */
export default function AccountsManager({
  rows,
  currentUid,
}: {
  rows: AdminAccountRow[];
  /** 当前登录账号的 uid（null = 主口令会话，不对应具体账号） */
  currentUid: number | null;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<number | 'new' | null>(null);

  const [showCreate, setShowCreate] = useState(rows.length === 0);
  const [form, setForm] = useState({ username: '', display_name: '', password: '' });

  // 最后一个启用中的账号：不允许停用/删除
  const activeCount = rows.filter((r) => r.is_active).length;

  async function call(method: 'PATCH' | 'DELETE', body: Record<string, unknown> | null, id?: number) {
    setBusyId(id ?? 'new');
    setError('');
    setNotice('');
    const url = method === 'DELETE' ? `/api/admin/accounts?id=${id}` : '/api/admin/accounts';
    const res = await fetch(url, {
      method,
      headers: method === 'PATCH' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'PATCH' ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    if (res.ok && data?.ok) {
      router.refresh();
    } else {
      setError(data?.message ?? '操作失败，请重试。');
    }
    setBusyId(null);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusyId('new');
    setError('');
    setNotice('');
    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; errors?: Record<string, string> } | null;
    if (res.ok && data?.ok) {
      setForm({ username: '', display_name: '', password: '' });
      setShowCreate(false);
      setNotice('账号已创建。');
      router.refresh();
    } else {
      const fieldError = data?.errors ? Object.values(data.errors)[0] : undefined;
      setError(fieldError ?? data?.message ?? '创建失败，请重试。');
    }
    setBusyId(null);
  }

  const inputCls =
    'rounded-lg border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-[13px] text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-brand-blue)]';

  function fmt(iso: string | null): string {
    if (!iso) return '从未登录';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="space-y-5">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600 ring-1 ring-red-100">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700 ring-1 ring-emerald-100">{notice}</p>}

      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)] text-[12px] text-[var(--color-ink-3)]">
                <th className="px-4 py-3 font-medium">用户名</th>
                <th className="px-4 py-3 font-medium">显示名</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">最近登录</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSelf = currentUid === r.id;
                const lastActive = r.is_active && activeCount <= 1;
                return (
                  <tr key={r.id} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-4 py-3 font-mono text-[12px] text-[var(--color-ink)]">
                      {r.username}
                      {isSelf && <span className="ml-2 rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] text-[var(--color-ink-3)]">当前登录</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-ink-2)]">{r.display_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${
                          r.is_active ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-gray-100 text-gray-500 ring-gray-200'
                        }`}
                      >
                        {r.is_active ? '启用' : '停用'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--color-ink-3)]">{fmt(r.last_login_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const name = window.prompt(`修改「${r.username}」的显示名`, r.display_name);
                            if (name && name.trim()) call('PATCH', { id: r.id, display_name: name.trim() }, r.id);
                          }}
                          disabled={busyId === r.id}
                          className="rounded-md px-2 py-1 text-[12px] font-medium text-[var(--color-brand-blue-deep)] transition-colors hover:bg-[var(--color-surface-2)] disabled:opacity-40"
                        >
                          改显示名
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const pwd = window.prompt(`为「${r.username}」设置新密码（至少 8 位）`);
                            if (pwd) call('PATCH', { id: r.id, password: pwd }, r.id);
                          }}
                          disabled={busyId === r.id}
                          className="rounded-md px-2 py-1 text-[12px] font-medium text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-surface-2)] disabled:opacity-40"
                        >
                          重置密码
                        </button>
                        <button
                          type="button"
                          onClick={() => call('PATCH', { id: r.id, is_active: !r.is_active }, r.id)}
                          disabled={busyId === r.id || isSelf || lastActive}
                          title={isSelf ? '不能停用当前登录账号' : lastActive ? '至少保留一个启用中的账号' : undefined}
                          className="rounded-md px-2 py-1 text-[12px] font-medium text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-surface-2)] disabled:opacity-40"
                        >
                          {r.is_active ? '停用' : '启用'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`确定删除账号「${r.username}」？不可恢复。`)) call('DELETE', null, r.id);
                          }}
                          disabled={busyId === r.id || isSelf || lastActive}
                          title={isSelf ? '不能删除当前登录账号' : lastActive ? '至少保留一个启用中的账号' : undefined}
                          className="rounded-md px-2 py-1 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate ? (
        <form onSubmit={create} className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-card)]">
          <p className="text-[13px] font-semibold text-[var(--color-brand-navy)]">新建管理员账号</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-[12px] text-[var(--color-ink-2)]">
              用户名
              <input
                required
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                placeholder="ops / 3-32 位小写字母数字-_"
                className={`${inputCls} mt-1 block w-52 font-mono`}
              />
            </label>
            <label className="text-[12px] text-[var(--color-ink-2)]">
              显示名
              <input
                required
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="运营同学"
                className={`${inputCls} mt-1 block w-40`}
              />
            </label>
            <label className="text-[12px] text-[var(--color-ink-2)]">
              初始密码
              <input
                required
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="至少 8 位"
                className={`${inputCls} mt-1 block w-44`}
              />
            </label>
            <button
              type="submit"
              disabled={busyId === 'new'}
              className="rounded-lg bg-[var(--color-brand-navy)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-3)] disabled:opacity-50"
            >
              {busyId === 'new' ? '创建中…' : '创建账号'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg px-3 py-2 text-[13px] text-[var(--color-ink-3)] hover:text-[var(--color-brand-navy)]"
            >
              取消
            </button>
          </div>
          <p className="mt-3 text-[12px] text-[var(--color-ink-3)]">密码仅以 scrypt 哈希入库，创建后不可再查看；请通过「重置密码」下发新密码。</p>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-[var(--color-brand-navy)] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-3)]"
        >
          + 新建管理员账号
        </button>
      )}
    </div>
  );
}
