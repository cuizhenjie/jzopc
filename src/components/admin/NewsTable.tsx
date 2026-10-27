'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { newsStatusLabels } from '@/lib/admin/news-schema';
import type { AdminNewsRow } from '@/lib/admin/data';
import { Button } from '@/components/admin/ui/button';
import { Card } from '@/components/admin/ui/card';
import { Empty } from '@/components/admin/ui/empty';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/admin/ui/table';
import { useConfirm } from '@/components/admin/ui/confirm';
import { Badge, fmtDate } from './crud/ui';

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
  const [confirm, confirmDialog] = useConfirm();

  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
  }

  async function toggleStatus(row: AdminNewsRow) {
    const next = row.status === 'published' ? 'archived' : 'published';
    if (next === 'archived') {
      const ok = await confirm({
        title: `下架「${row.title}」`,
        description: '下架后前台详情页将立即 404。日常调整内容请用「编辑」。',
        actionLabel: '下架',
      });
      if (!ok) return;
    }
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
    const ok = await confirm({
      title: `彻底删除「${row.title}」`,
      description: '不可恢复。日常下架请用「下架」按钮。',
      actionLabel: '删除',
      destructive: true,
    });
    if (!ok) return;
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
      <Table className="min-w-[880px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>标题</TableHead>
            <TableHead>分类</TableHead>
            <TableHead>作者</TableHead>
            <TableHead>发布时间</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((n) => (
            <TableRow key={n.id}>
              <TableCell className="max-w-[380px] whitespace-normal">
                <p className="truncate font-medium text-foreground">{n.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">/news/{n.slug}</p>
              </TableCell>
              <TableCell className="text-[var(--color-ink-2)]">{n.category}</TableCell>
              <TableCell className="text-[var(--color-ink-2)]">{n.author ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{fmtDate(n.published_at)}</TableCell>
              <TableCell>
                <Badge className={statusBadge[n.status] ?? statusBadge.archived}>
                  {newsStatusLabels[n.status as keyof typeof newsStatusLabels] ?? n.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {n.status === 'published' && (
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/news/${n.slug}`} target="_blank">
                        预览
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="ghost" size="sm" className="text-[var(--color-brand-blue-deep)]">
                    <Link href={`/admin/news/${n.id}/edit`}>编辑</Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleStatus(n)} disabled={busyId === n.id}>
                    {n.status === 'published' ? '下架' : '发布'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(n)}
                    disabled={busyId === n.id}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    删除
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {confirmDialog}
    </Card>
  );
}
