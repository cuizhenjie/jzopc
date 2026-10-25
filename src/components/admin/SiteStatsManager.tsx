'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminSiteStatRow } from '@/lib/admin/resources';

/**
 * 统计数字的行内编辑管理器：每行直接改数值 / 后缀 / 标签 / 排序，失焦或点保存提交。
 * site_stats 是 key 主键的小表，行内编辑比跳转编辑页更顺手（CRMEB 式「配置页」体验）。
 */
export default function SiteStatsManager({ rows }: { rows: AdminSiteStatRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, AdminSiteStatRow>>(() =>
    Object.fromEntries(rows.map((r) => [r.key, { ...r }])),
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const [newRow, setNewRow] = useState({ key: '', value: 0, suffix: '+', label: '', sort_order: 0 });
  const [creating, setCreating] = useState(false);

  function update(key: string, patch: Partial<AdminSiteStatRow>) {
    setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  }

  async function save(key: string) {
    setBusyKey(key);
    setError('');
    setSavedKey(null);
    const row = draft[key];
    const res = await fetch('/api/admin/site-stats', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value: row.value, suffix: row.suffix, label: row.label, sort_order: row.sort_order }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    if (res.ok && data?.ok) {
      setSavedKey(key);
      router.refresh();
    } else {
      setError(data?.message ?? '保存失败，请重试。');
    }
    setBusyKey(null);
  }

  async function remove(key: string) {
    if (!window.confirm(`确定删除「${draft[key]?.label ?? key}」？首页数字墙将不再显示该项。`)) return;
    setBusyKey(key);
    setError('');
    const res = await fetch(`/api/admin/site-stats?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    if (res.ok && data?.ok) {
      router.refresh();
    } else {
      setError(data?.message ?? '删除失败，请重试。');
    }
    setBusyKey(null);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    const res = await fetch('/api/admin/site-stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRow),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; errors?: Record<string, string> } | null;
    if (res.ok && data?.ok) {
      setNewRow({ key: '', value: 0, suffix: '+', label: '', sort_order: 0 });
      router.refresh();
    } else {
      const fieldError = data?.errors ? Object.values(data.errors)[0] : undefined;
      setError(fieldError ?? data?.message ?? '创建失败，请重试。');
    }
    setCreating(false);
  }

  const inputCls =
    'rounded-lg border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-[13px] text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-brand-blue)]';

  return (
    <div className="space-y-5">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600 ring-1 ring-red-100">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)] text-[12px] text-[var(--color-ink-3)]">
                <th className="px-4 py-3 font-medium">Key</th>
                <th className="px-4 py-3 font-medium">数值</th>
                <th className="px-4 py-3 font-medium">后缀</th>
                <th className="px-4 py-3 font-medium">标签</th>
                <th className="px-4 py-3 font-medium">排序</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[var(--color-ink-3)]">
                    库内还没有统计数字 —— 在下方添加第一项（保存后首页数字墙立即生效）。
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const d = draft[r.key] ?? r;
                const dirty = JSON.stringify(d) !== JSON.stringify(r);
                return (
                  <tr key={r.key} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-4 py-2.5 font-mono text-[12px] text-[var(--color-ink-3)]">{r.key}</td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        value={d.value}
                        min={0}
                        onChange={(e) => update(r.key, { value: Number(e.target.value) })}
                        className={`${inputCls} w-28`}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <input value={d.suffix} onChange={(e) => update(r.key, { suffix: e.target.value })} className={`${inputCls} w-16`} />
                    </td>
                    <td className="px-4 py-2.5">
                      <input value={d.label} onChange={(e) => update(r.key, { label: e.target.value })} className={`${inputCls} w-40`} />
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="number"
                        value={d.sort_order}
                        min={0}
                        onChange={(e) => update(r.key, { sort_order: Number(e.target.value) })}
                        className={`${inputCls} w-20`}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => save(r.key)}
                          disabled={busyKey === r.key || !dirty}
                          className="rounded-lg bg-[var(--color-brand-navy)] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[var(--color-brand-navy-3)] disabled:opacity-40"
                        >
                          {busyKey === r.key ? '保存中…' : savedKey === r.key ? '已保存 ✓' : '保存'}
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(r.key)}
                          disabled={busyKey === r.key}
                          className="rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40"
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

      <form onSubmit={create} className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-[13px] font-semibold text-[var(--color-brand-navy)]">新增统计数字</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-[12px] text-[var(--color-ink-2)]">
            Key
            <input
              required
              value={newRow.key}
              onChange={(e) => setNewRow((r) => ({ ...r, key: e.target.value.toLowerCase() }))}
              placeholder="companies"
              className={`${inputCls} mt-1 block w-32 font-mono`}
            />
          </label>
          <label className="text-[12px] text-[var(--color-ink-2)]">
            数值
            <input
              required
              type="number"
              min={0}
              value={newRow.value}
              onChange={(e) => setNewRow((r) => ({ ...r, value: Number(e.target.value) }))}
              className={`${inputCls} mt-1 block w-28`}
            />
          </label>
          <label className="text-[12px] text-[var(--color-ink-2)]">
            后缀
            <input value={newRow.suffix} onChange={(e) => setNewRow((r) => ({ ...r, suffix: e.target.value }))} className={`${inputCls} mt-1 block w-16`} />
          </label>
          <label className="text-[12px] text-[var(--color-ink-2)]">
            标签
            <input
              required
              value={newRow.label}
              onChange={(e) => setNewRow((r) => ({ ...r, label: e.target.value }))}
              placeholder="入驻企业"
              className={`${inputCls} mt-1 block w-36`}
            />
          </label>
          <label className="text-[12px] text-[var(--color-ink-2)]">
            排序
            <input
              type="number"
              min={0}
              value={newRow.sort_order}
              onChange={(e) => setNewRow((r) => ({ ...r, sort_order: Number(e.target.value) }))}
              className={`${inputCls} mt-1 block w-20`}
            />
          </label>
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-[var(--color-brand-navy)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-3)] disabled:opacity-50"
          >
            {creating ? '创建中…' : '+ 添加'}
          </button>
        </div>
      </form>
    </div>
  );
}
