'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Badge, publishedBadge } from './ui';

/**
 * 通用资源表格：把 NewsTable/LeadsTable 里反复出现的
 * 「表格 + 上下架开关 + 编辑 + 删除 + 错误条 + 空态」组件化。
 *
 * 面向 `published boolean` 口径的内容表（agents / market_items / courses /
 * partners / site_contents / empower_modules…）；news_posts 的三态 status
 * 仍走专用 NewsTable（语义不同，不硬塞进来）。
 *
 * 列由使用方声明（cell 是 ReactNode 渲染函数，服务端页面也能拼），
 * 行操作统一收敛：预览（可选）/ 编辑 / 发布·下架 / 删除。
 */

/**
 * 行约束极小化：只要求可识别与「可选的 published 开关」。
 * slug 主键（empower_modules）与无 published 列（media_assets）的资源都能接。
 */
export type ResourceRow = {
  id?: number | string;
  published?: boolean;
};

export type ResourceColumn<T> = {
  head: string;
  cell: (row: T) => ReactNode;
  className?: string;
};

export default function ResourceTable<T extends ResourceRow = ResourceRow>({
  rows,
  columns,
  apiBase,
  rowKey,
  editHref,
  viewHref,
  nameOf,
  createHref,
  emptyTitle = '暂无内容',
  emptyCta = '新建第一条',
  publishLabels = { on: '下架', off: '发布' },
  confirmArchive,
}: {
  rows: T[];
  columns: ResourceColumn<T>[];
  /** REST 基址，如 /api/admin/agents；PATCH {published} 与 DELETE 都打这里 */
  apiBase: string;
  editHref: (row: T) => string;
  /** 已发布行的前台预览链接（返回 undefined 则不显示） */
  viewHref?: (row: T) => string | undefined;
  /** 删除确认弹窗里展示的资源名 */
  nameOf: (row: T) => string;
  /** 行标识（默认取 row.id；slug 主键的模块传 row.slug） */
  rowKey?: (row: T) => string | number;
  createHref: string;
  emptyTitle?: string;
  emptyCta?: string;
  publishLabels?: { on: string; off: string };
  confirmArchive?: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | string | null>(null);
  const [error, setError] = useState('');

  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
  }

  async function togglePublish(row: T) {
    const next = !row.published;
    if (
      !next &&
      !window.confirm(confirmArchive ?? `确定下架「${nameOf(row)}」？前台将立即不可见。`)
    )
      return;
    const key = rowKey ? rowKey(row) : row.id;
    setBusyId(key ?? null);
    setError('');
    const res = await fetch(`${apiBase}/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: next }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(data?.message ?? '操作失败，请重试。');
    }
    setBusyId(null);
  }

  async function remove(row: T) {
    if (!window.confirm(`确定彻底删除「${nameOf(row)}」？不可恢复（日常下架请用「${publishLabels.on}」按钮）。`))
      return;
    const key = rowKey ? rowKey(row) : row.id;
    setBusyId(key ?? null);
    setError('');
    const res = await fetch(`${apiBase}/${row.id}`, { method: 'DELETE' });
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
        <table className="w-full min-w-[820px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-surface)] text-[12px] text-[var(--color-ink-3)]">
              {columns.map((c) => (
                <th key={c.head} className={`px-4 py-3 font-medium ${c.className ?? ''}`}>
                  {c.head}
                </th>
              ))}
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey ? rowKey(row) : row.id}
                className="border-b border-[var(--color-line)] last:border-0 transition-colors hover:bg-[var(--color-surface)]/60"
              >
                {columns.map((c) => (
                  <td key={c.head} className={`px-4 py-3 ${c.className ?? ''}`}>
                    {c.cell(row)}
                  </td>
                ))}
                <td className="px-4 py-3">
                  {typeof row.published === 'boolean' ? (
                    <Badge className={publishedBadge(row.published)}>
                      {row.published ? '已发布' : '草稿'}
                    </Badge>
                  ) : (
                    <Badge className="bg-[var(--color-surface)] text-[var(--color-ink-2)] ring-[var(--color-line)]">已登记</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {row.published && viewHref?.(row) && (
                      <Link
                        href={viewHref(row) as string}
                        target="_blank"
                        className="rounded-md px-2 py-1 text-[12px] font-medium text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-brand-navy)]"
                      >
                        预览
                      </Link>
                    )}
                    <Link
                      href={editHref(row)}
                      className="rounded-md px-2 py-1 text-[12px] font-medium text-[var(--color-brand-blue-deep)] transition-colors hover:bg-[var(--color-surface-2)]"
                    >
                      编辑
                    </Link>
                    {typeof row.published === 'boolean' && (
                    <button
                      type="button"
                      onClick={() => togglePublish(row)}
                      disabled={busyId === (rowKey ? rowKey(row) : row.id)}
                      className="rounded-md px-2 py-1 text-[12px] font-medium text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-brand-navy)] disabled:opacity-50"
                    >
                      {row.published ? publishLabels.on : publishLabels.off}
                    </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(row)}
                      disabled={busyId === (rowKey ? rowKey(row) : row.id)}
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
