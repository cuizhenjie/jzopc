'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { newsStatusLabels } from '@/lib/admin/news-schema';
import type { AdminNewsRow } from '@/lib/admin/data';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit' });
}

const statusBadge: Record<string, string> = {
  published: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  draft: 'bg-amber-50 text-amber-700 ring-amber-200',
  archived: 'bg-gray-100 text-gray-500 ring-gray-200',
};

export default function NewsTable({
  rows,
  createHref = '/admin/news/new',
  emptyTitle = '该状态下暂无动态',
  emptyCta = '发布第一篇',
}: {
  rows: AdminNewsRow[];
  /** 空状态的「新建」入口。活动列表传 /admin/news/new?preset=活动。 */
  createHref?: string;
  emptyTitle?: string;
  emptyCta?: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
  }

  async function toggleStatus(row: AdminNewsRow) {
    const next = row.status === 'published' ? 'archived' : 'published';
    if (next === 'archived' && !window.confirm(`确定下架「${row.title}」？前台详情页将立即 404。`)) return;
    setBusyId(row.id);
    setError('');
    const res = await fetch(`/api/admin/news/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(data?.message ?? '操作失败，请重试。');
    }
    setBusyId(null);
  }

  async function remove(row: AdminNewsRow) {
    if (!window.confirm(`确定彻底删除「${row.title}」？不可恢复（日常下架请用「下架」按钮）。`)) return;
    setBusyId(row.id);
    setError('');
    const res = await fetch(`/api/admin/news/${row.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.refresh();
    } else {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(data?.message ?? '删除失败，请重试。');
    }
    setBusyId(null);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-line)] bg-white px-8 py-16 text-center">
        <p className="text-[15px] font-medium text-[var(--color-brand-navy)]">{emptyTitle}</p>
        <Link
          href={createHref}
          className="mt-3 inline-block text-[13px] font-medium text-[var(--color-brand-blue-deep)] hover:underline"
        >
          {emptyCta} →
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-card)]">
      {error && (
        <p className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)] text-[12px] text-[var(--color-ink-3)]">
              <th className="px-4 py-3 font-medium">标题</th>
              <th className="px-4 py-3 font-medium">分类</th>
              <th className="px-4 py-3 font-medium">作者</th>
              <th className="px-4 py-3 font-medium">发布时间</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id} className="border-b border-[var(--color-line)] last:border-0 transition-colors hover:bg-[var(--color-surface)]/60">
                <td className="max-w-[380px] px-4 py-3">
                  <p className="truncate font-medium text-[var(--color-ink)]">{n.title}</p>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--color-ink-3)]">/news/{n.slug}</p>
                </td>
                <td className="px-4 py-3 text-[var(--color-ink-2)]">{n.category}</td>
                <td className="px-4 py-3 text-[var(--color-ink-2)]">{n.author ?? '—'}</td>
                <td className="px-4 py-3 text-[var(--color-ink-3)]">{fmtDate(n.published_at)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${statusBadge[n.status] ?? statusBadge.archived}`}
                  >
                    {newsStatusLabels[n.status as keyof typeof newsStatusLabels] ?? n.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {n.status === 'published' && (
                      <Link
                        href={`/news/${n.slug}`}
                        target="_blank"
                        className="rounded-md px-2 py-1 text-[12px] font-medium text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-brand-navy)]"
                      >
                        预览
                      </Link>
                    )}
                    <Link
                      href={`/admin/news/${n.id}/edit`}
                      className="rounded-md px-2 py-1 text-[12px] font-medium text-[var(--color-brand-blue-deep)] transition-colors hover:bg-[var(--color-surface-2)]"
                    >
                      编辑
                    </Link>
                    <button
                      type="button"
                      onClick={() => toggleStatus(n)}
                      disabled={busyId === n.id}
                      className="rounded-md px-2 py-1 text-[12px] font-medium text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-brand-navy)] disabled:opacity-50"
                    >
                      {n.status === 'published' ? '下架' : '发布'}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(n)}
                      disabled={busyId === n.id}
                      className="rounded-md px-2 py-1 text-[12px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
