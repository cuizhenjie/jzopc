'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import {
  LEAD_STATUSES,
  leadStatusLabels,
  leadTypeLabels,
  type AdminLeadRow,
} from '@/lib/admin/data';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function LeadsTable({ rows }: { rows: AdminLeadRow[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});
  const [error, setError] = useState('');

  // 外层筛选/翻页后 rows 变化，渲染期同步本地态（router.refresh() 会重新传 props；
  // 这是 React 官方的「render 期调整 state」模式，避免用 effect 造成的多渲染一帧）
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setList(rows);
  }

  async function patchLead(id: number, patch: { status?: string; note?: string }) {
    setError('');
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(data?.message ?? '操作失败，请重试。');
      return false;
    }
    return true;
  }

  async function updateStatus(id: number, status: string) {
    setSavingId(id);
    const prev = list;
    setList((l) => l.map((r) => (r.id === id ? { ...r, status } : r)));
    const ok = await patchLead(id, { status });
    if (!ok) setList(prev);
    setSavingId(null);
  }

  async function saveNote(id: number) {
    const note = noteDraft[id] ?? list.find((r) => r.id === id)?.note ?? '';
    setSavingId(id);
    const ok = await patchLead(id, { note });
    if (ok) {
      setList((l) => l.map((r) => (r.id === id ? { ...r, note: note.trim() || null } : r)));
      setNoteDraft((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    }
    setSavingId(null);
  }

  async function removeLead(id: number, name: string) {
    if (!window.confirm(`确定删除线索「${name}」？此操作不可恢复。`)) return;
    setSavingId(id);
    setError('');
    const res = await fetch(`/api/admin/leads/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setList((l) => l.filter((r) => r.id !== id));
      router.refresh();
    } else {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(data?.message ?? '删除失败，请重试。');
    }
    setSavingId(null);
  }

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-line)] bg-white px-8 py-16 text-center">
        <p className="text-[15px] font-medium text-[var(--color-brand-navy)]">没有匹配的线索</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-[var(--color-ink-3)]">
          表单提交后会自动出现在这里。若已提交但看不到，请检查 Supabase 连接与
          <code className="mx-1 rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[12px]">leads</code>
          表配置。
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-card)]">
      {error && (
        <p className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)] text-[12px] text-[var(--color-ink-3)]">
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">姓名</th>
              <th className="px-4 py-3 font-medium">联系方式</th>
              <th className="px-4 py-3 font-medium">公司/团队</th>
              <th className="px-4 py-3 font-medium">来源页</th>
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium" aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <Fragment key={r.id}>
                <tr
                  className={`border-b border-[var(--color-line)] transition-colors hover:bg-[var(--color-surface)]/60 ${expanded === r.id ? 'bg-[var(--color-surface)]/60' : ''}`}
                >
                  <td className="px-4 py-3">
                    <span className="rounded bg-[var(--color-brand-blue)]/8 px-2 py-0.5 text-[11px] font-medium text-[var(--color-brand-blue-deep)]">
                      {leadTypeLabels[r.lead_type] ?? r.lead_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{r.name}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-2)]">
                    {r.contact}
                    <span className="ml-1.5 text-[11px] text-[var(--color-ink-3)]">
                      {r.contact_type === 'phone' ? '手机' : '邮箱'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-2)]">
                    {r.org_name ?? '—'}
                    {r.track && <span className="ml-1.5 text-[11px] text-[var(--color-ink-3)]">{r.track}</span>}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-ink-3)]">{r.source_page}</td>
                  <td className="px-4 py-3 text-[var(--color-ink-3)]">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={r.status}
                      disabled={savingId === r.id}
                      onChange={(e) => updateStatus(r.id, e.target.value)}
                      aria-label={`更新 ${r.name} 的线索状态`}
                      className="rounded-md border border-[var(--color-line)] bg-white px-2 py-1 text-[16px] outline-none focus:border-[var(--color-brand-blue)] disabled:opacity-50 sm:text-[12px]"
                    >
                      {LEAD_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {leadStatusLabels[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      className="rounded-md px-2 py-1 text-[12px] font-medium text-[var(--color-brand-blue-deep)] transition-colors hover:bg-[var(--color-surface-2)]"
                      aria-expanded={expanded === r.id}
                    >
                      {expanded === r.id ? '收起' : '详情'}
                    </button>
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)]/50">
                    <td colSpan={8} className="px-4 py-5">
                      <div className="grid gap-5 lg:grid-cols-2">
                        <dl className="space-y-2.5 text-[13px]">
                          <div className="flex gap-3">
                            <dt className="w-20 shrink-0 text-[var(--color-ink-3)]">职务</dt>
                            <dd className="text-[var(--color-ink-2)]">{r.role ?? '—'}</dd>
                          </div>
                          <div className="flex gap-3">
                            <dt className="w-20 shrink-0 text-[var(--color-ink-3)]">意向方向</dt>
                            <dd className="text-[var(--color-ink-2)]">
                              {r.subject_type ?? '—'}
                              {r.team_size != null && <span className="ml-2 text-[12px] text-[var(--color-ink-3)]">团队 {r.team_size} 人</span>}
                            </dd>
                          </div>
                          <div className="flex gap-3">
                            <dt className="w-20 shrink-0 text-[var(--color-ink-3)]">来源引用</dt>
                            <dd className="break-all text-[var(--color-ink-2)]">{r.source_ref ?? '—'}</dd>
                          </div>
                          <div className="flex gap-3">
                            <dt className="w-20 shrink-0 text-[var(--color-ink-3)]">UTM</dt>
                            <dd className="text-[var(--color-ink-2)]">
                              {r.utm && Object.keys(r.utm).length > 0 ? (
                                <span className="flex flex-wrap gap-1.5">
                                  {Object.entries(r.utm).map(([k, v]) => (
                                    <span key={k} className="rounded bg-white px-1.5 py-0.5 text-[11px] ring-1 ring-[var(--color-line)]">
                                      {k}={String(v)}
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                '—'
                              )}
                            </dd>
                          </div>
                          <div className="flex gap-3">
                            <dt className="w-20 shrink-0 align-top text-[var(--color-ink-3)]">留言</dt>
                            <dd className="whitespace-pre-wrap leading-relaxed text-[var(--color-ink-2)]">{r.message ?? '—'}</dd>
                          </div>
                          <div className="flex gap-3">
                            <dt className="w-20 shrink-0 text-[var(--color-ink-3)]">更新时间</dt>
                            <dd className="text-[var(--color-ink-2)]">{fmtDate(r.updated_at)}</dd>
                          </div>
                        </dl>

                        <div>
                          <label
                            htmlFor={`note-${r.id}`}
                            className="block text-[12px] font-medium text-[var(--color-ink-3)]"
                          >
                            跟进备注
                          </label>
                          <textarea
                            id={`note-${r.id}`}
                            value={noteDraft[r.id] ?? r.note ?? ''}
                            onChange={(e) => setNoteDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                            rows={5}
                            maxLength={2000}
                            placeholder="记录沟通进展、下一步动作…"
                            className="mt-2 w-full resize-y rounded-xl border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--color-ink)] outline-none focus:border-[var(--color-brand-blue)]"
                          />
                          <div className="mt-3 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => saveNote(r.id)}
                              disabled={savingId === r.id}
                              className="rounded-lg bg-[var(--color-brand-navy)] px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-3)] disabled:opacity-50"
                            >
                              {savingId === r.id ? '保存中…' : '保存备注'}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeLead(r.id, r.name)}
                              disabled={savingId === r.id}
                              className="rounded-lg border border-red-200 px-4 py-2 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                            >
                              删除线索
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
