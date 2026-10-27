'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/admin/ui/button';
import { Card, CardHeader } from '@/components/admin/ui/card';
import { Empty } from '@/components/admin/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/admin/ui/table';
import { useConfirm } from '@/components/admin/ui/confirm';
import { Badge, publishedBadge } from './ui';

/**
 * 通用资源表格（shadcn/ui 底座）：把 NewsTable/LeadsTable 里反复出现的
 * 「表格 + 上下架开关 + 编辑 + 删除 + 错误条 + 空态」组件化。
 *
 * 面向 `published boolean` 口径的内容表（agents / market_items / courses /
 * partners / site_contents / empower_modules…）；news_posts 的三态 status
 * 仍走专用 NewsTable（语义不同，不硬塞进来）。
 *
 * 列由使用方声明（cell 是 ReactNode 渲染函数，服务端页面也能拼），
 * 行操作统一收敛：预览（可选）/ 编辑 / 发布·下架 / 删除（AlertDialog 确认）。
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
  toolbar,
  countLabel,
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
  /** 表头右侧工具位（筛选、批量操作等，由使用方注入） */
  toolbar?: ReactNode;
  /** 左侧计数文案；默认「共 N 条」 */
  countLabel?: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | string | null>(null);
  const [error, setError] = useState('');
  const [confirm, confirmDialog] = useConfirm();

  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
  }

  async function togglePublish(row: T) {
    const next = !row.published;
    if (!next) {
      const okToArchive = await confirm({
        title: confirmArchive ? '确认下架' : `下架「${nameOf(row)}」`,
        description: confirmArchive ?? `确定下架「${nameOf(row)}」？前台将立即不可见。`,
        actionLabel: publishLabels.on,
      });
      if (!okToArchive) return;
    }
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
    const ok = await confirm({
      title: `彻底删除「${nameOf(row)}」`,
      description: `不可恢复。日常下架请用「${publishLabels.on}」按钮。`,
      actionLabel: '删除',
      destructive: true,
    });
    if (!ok) return;
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
      <>
        <Empty
          title={emptyTitle}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={createHref}>{emptyCta} →</Link>
            </Button>
          }
        />
        {confirmDialog}
      </>
    );
  }

  return (
    <Card className="overflow-hidden">
      {error && (
        <p className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</p>
      )}
      {/* 头部条：常驻显示条数（编辑者扫一眼就知道列表规模），右侧留工具位 */}
      <CardHeader>
        <span className="text-[12.5px] text-muted-foreground">{countLabel ?? `共 ${rows.length} 条`}</span>
        {toolbar && <div className="flex flex-wrap items-center gap-2">{toolbar}</div>}
      </CardHeader>
      <Table className="min-w-[820px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead key={c.head} className={c.className}>
                {c.head}
              </TableHead>
            ))}
            <TableHead>状态</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const key = rowKey ? rowKey(row) : row.id;
            return (
              <TableRow key={key}>
                {columns.map((c) => (
                  <TableCell key={c.head} className={c.className}>
                    {c.cell(row)}
                  </TableCell>
                ))}
                <TableCell>
                  {typeof row.published === 'boolean' ? (
                    <Badge className={publishedBadge(row.published)}>
                      {row.published ? '已发布' : '草稿'}
                    </Badge>
                  ) : (
                    <Badge className="bg-secondary text-[var(--color-ink-2)] ring-border">已登记</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {row.published && viewHref?.(row) && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={viewHref(row) as string} target="_blank">
                          预览
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="sm" className="text-[var(--color-brand-blue-deep)]">
                      <Link href={editHref(row)}>编辑</Link>
                    </Button>
                    {typeof row.published === 'boolean' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePublish(row)}
                        disabled={busyId === key}
                      >
                        {row.published ? publishLabels.on : publishLabels.off}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(row)}
                      disabled={busyId === key}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      删除
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {confirmDialog}
    </Card>
  );
}
