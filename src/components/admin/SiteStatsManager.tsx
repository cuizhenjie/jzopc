'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminSiteStatRow } from '@/lib/admin/resources';
import { Button } from '@/components/admin/ui/button';
import { Card } from '@/components/admin/ui/card';
import { Input } from '@/components/admin/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/admin/ui/table';
import { useConfirm } from '@/components/admin/ui/confirm';

/**
 * 统计数字的行内编辑管理器：每行直接改数值 / 后缀 / 标签 / 排序，失焦或点保存提交。
 * site_stats 是 key 主键的小表，行内编辑比跳转编辑页更顺手（CRMEB 式「配置页」体验）。
 */
export default function SiteStatsManager({ rows }: { rows: AdminSiteStatRow[] }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
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
    const ok = await confirm({
      title: `删除「${draft[key]?.label ?? key}」`,
      description: '删除后首页数字墙将不再显示该项。',
      actionLabel: '删除',
      destructive: true,
    });
    if (!ok) return;
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

  /** 行内紧凑输入（比标准 Input 矮一档，适合表格行内编辑） */
  const cellInputCls = 'h-8 rounded-lg px-2.5 text-[13px]';

  return (
    <div className="space-y-5">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600 ring-1 ring-red-100">{error}</p>}

      <Card className="overflow-hidden">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Key</TableHead>
              <TableHead>数值</TableHead>
              <TableHead>后缀</TableHead>
              <TableHead>标签</TableHead>
              <TableHead>排序</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  库内还没有统计数字 —— 在下方添加第一项（保存后首页数字墙立即生效）。
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => {
              const d = draft[r.key] ?? r;
              const dirty = JSON.stringify(d) !== JSON.stringify(r);
              return (
                <TableRow key={r.key}>
                  <TableCell className="font-mono text-[12px] text-muted-foreground">{r.key}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={d.value}
                      min={0}
                      onChange={(e) => update(r.key, { value: Number(e.target.value) })}
                      className={`${cellInputCls} w-28`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input value={d.suffix} onChange={(e) => update(r.key, { suffix: e.target.value })} className={`${cellInputCls} w-16`} />
                  </TableCell>
                  <TableCell>
                    <Input value={d.label} onChange={(e) => update(r.key, { label: e.target.value })} className={`${cellInputCls} w-40`} />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={d.sort_order}
                      min={0}
                      onChange={(e) => update(r.key, { sort_order: Number(e.target.value) })}
                      className={`${cellInputCls} w-20`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => save(r.key)} disabled={busyKey === r.key || !dirty}>
                        {busyKey === r.key ? '保存中…' : savedKey === r.key ? '已保存 ✓' : '保存'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove(r.key)}
                        disabled={busyKey === r.key}
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
      </Card>

      <Card className="p-5">
        <p className="text-[13px] font-semibold text-[var(--color-brand-navy)]">新增统计数字</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-[12px] text-[var(--color-ink-2)]">
            Key
            <Input
              required
              value={newRow.key}
              onChange={(e) => setNewRow((r) => ({ ...r, key: e.target.value.toLowerCase() }))}
              placeholder="companies"
              className="mt-1 block w-32 font-mono"
            />
          </label>
          <label className="text-[12px] text-[var(--color-ink-2)]">
            数值
            <Input
              required
              type="number"
              min={0}
              value={newRow.value}
              onChange={(e) => setNewRow((r) => ({ ...r, value: Number(e.target.value) }))}
              className="mt-1 block w-28"
            />
          </label>
          <label className="text-[12px] text-[var(--color-ink-2)]">
            后缀
            <Input value={newRow.suffix} onChange={(e) => setNewRow((r) => ({ ...r, suffix: e.target.value }))} className="mt-1 block w-16" />
          </label>
          <label className="text-[12px] text-[var(--color-ink-2)]">
            标签
            <Input
              required
              value={newRow.label}
              onChange={(e) => setNewRow((r) => ({ ...r, label: e.target.value }))}
              placeholder="入驻企业"
              className="mt-1 block w-36"
            />
          </label>
          <label className="text-[12px] text-[var(--color-ink-2)]">
            排序
            <Input
              type="number"
              min={0}
              value={newRow.sort_order}
              onChange={(e) => setNewRow((r) => ({ ...r, sort_order: Number(e.target.value) }))}
              className="mt-1 block w-20"
            />
          </label>
          <Button type="submit" disabled={creating}>
            {creating ? '创建中…' : '+ 添加'}
          </Button>
        </div>
      </Card>
      {confirmDialog}
    </div>
  );
}
