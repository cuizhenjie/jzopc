'use client';

import { useState } from 'react';

export type LeadRow = {
  id: number;
  lead_type: string;
  name: string;
  contact_type: string;
  contact: string;
  org_name: string | null;
  role: string | null;
  subject_type: string | null;
  team_size: number | null;
  track: string | null;
  message: string | null;
  source_page: string;
  source_ref: string | null;
  status: string;
  note: string | null;
  created_at: string;
};

const typeLabel: Record<string, string> = {
  apply: '申请入驻',
  compute: '算力',
  enterprise: '企服',
  traffic: '流量',
  capital: '资本',
  space: '空间',
  course: '课程',
  market: '供需',
  subscribe: '订阅',
  contact: '咨询',
};

export default function LeadTable({
  rows,
  statusLabel,
}: {
  rows: LeadRow[];
  statusLabel: Record<string, string>;
}) {
  const [list, setList] = useState(rows);
  const [saving, setSaving] = useState<number | null>(null);

  async function updateStatus(id: number, status: string) {
    setSaving(id);
    const prev = list;
    setList((l) => l.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      const res = await fetch('/api/ops/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      setList(prev);
    } finally {
      setSaving(null);
    }
  }

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-8 py-16 text-center">
        <p className="text-[15px] font-medium text-[var(--color-brand-navy)]">还没有线索</p>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-[var(--color-ink-3)]">
          表单提交后会自动出现在这里。若已提交但看不到，检查 Supabase 的
          <code className="mx-1 rounded bg-white px-1.5 py-0.5 text-[12px]">leads</code>
          表与 RLS 配置。
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)] bg-white">
      <table className="w-full min-w-[900px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)] text-[12px] text-[var(--color-ink-3)]">
            <th className="px-4 py-3 font-medium">类型</th>
            <th className="px-4 py-3 font-medium">姓名</th>
            <th className="px-4 py-3 font-medium">联系方式</th>
            <th className="px-4 py-3 font-medium">团队/项目</th>
            <th className="px-4 py-3 font-medium">来源页</th>
            <th className="px-4 py-3 font-medium">时间</th>
            <th className="px-4 py-3 font-medium">状态</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id} className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-surface)]/60">
              <td className="px-4 py-3">
                <span className="rounded bg-[var(--color-brand-blue)]/8 px-2 py-0.5 text-[11px] font-medium text-[var(--color-brand-blue-deep)]">
                  {typeLabel[r.lead_type] ?? r.lead_type}
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
              <td className="px-4 py-3 text-[var(--color-ink-3)]">
                {new Date(r.created_at).toLocaleString('zh-CN', { hour12: false })}
              </td>
              <td className="px-4 py-3">
                <select
                  value={r.status}
                  disabled={saving === r.id}
                  onChange={(e) => updateStatus(r.id, e.target.value)}
                  className="rounded-md border border-[var(--color-line)] bg-white px-2 py-1 text-[12px] outline-none focus:border-[var(--color-brand-blue)] disabled:opacity-50"
                >
                  {Object.entries(statusLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
