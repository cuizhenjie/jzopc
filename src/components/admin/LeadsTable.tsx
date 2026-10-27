'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';
import {
  LEAD_STATUSES,
  leadStatusLabels,
  leadTypeLabels,
  type AdminLeadRow,
} from '@/lib/admin/data';
import { Badge } from '@/components/admin/ui/badge';
import { Button } from '@/components/admin/ui/button';
import { Card } from '@/components/admin/ui/card';
import { Empty } from '@/components/admin/ui/empty';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/admin/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/admin/ui/table';
import { Textarea } from '@/components/admin/ui/textarea';
import { useConfirm } from '@/components/admin/ui/confirm';
import { fmtDate } from './crud/ui';

export default function LeadsTable({ rows }: { rows: AdminLeadRow[] }) {
  const router = useRouter();
  const [list, setList] = useState(rows);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const [confirm, confirmDialog] = useConfirm();

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
    const ok = await confirm({
      title: `删除线索「${name}」`,
      description: '此操作不可恢复。',
      actionLabel: '删除',
      destructive: true,
    });
    if (!ok) return;
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
      <Empty
        title="没有匹配的线索"
        description={
          <>
            表单提交后会自动出现在这里。若已提交但看不到，请检查 Supabase 连接与
            <code className="mx-1 rounded bg-secondary px-1.5 py-0.5 text-[12px]">leads</code>
            表配置。
          </>
        }
      />
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        {error && (
          <p className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</p>
        )}
        <Table className="min-w-[960px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>类型</TableHead>
              <TableHead>姓名</TableHead>
              <TableHead>联系方式</TableHead>
              <TableHead>公司/团队</TableHead>
              <TableHead>来源页</TableHead>
              <TableHead>时间</TableHead>
              <TableHead>状态</TableHead>
              <TableHead aria-label="操作" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <Fragment key={r.id}>
                <TableRow
                  data-state={expanded === r.id ? 'selected' : undefined}
                  className={expanded === r.id ? 'bg-muted/60' : undefined}
                >
                  <TableCell>
                    <Badge variant="info">{leadTypeLabels[r.lead_type] ?? r.lead_type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{r.name}</TableCell>
                  <TableCell className="text-[var(--color-ink-2)]">
                    {r.contact}
                    <span className="ml-1.5 text-[11px] text-muted-foreground">
                      {r.contact_type === 'phone' ? '手机' : '邮箱'}
                    </span>
                  </TableCell>
                  <TableCell className="text-[var(--color-ink-2)]">
                    {r.org_name ?? '—'}
                    {r.track && <span className="ml-1.5 text-[11px] text-muted-foreground">{r.track}</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.source_page}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                  <TableCell>
                    <Select
                      value={r.status}
                      onValueChange={(v) => updateStatus(r.id, v)}
                      disabled={savingId === r.id}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label={`更新 ${r.name} 的线索状态`}
                        className="w-[7.5rem]"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {LEAD_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {leadStatusLabels[s]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      aria-expanded={expanded === r.id}
                      className="text-[var(--color-brand-blue-deep)]"
                    >
                      {expanded === r.id ? '收起' : '详情'}
                    </Button>
                  </TableCell>
                </TableRow>
                {expanded === r.id && (
                  <tr className="border-b border-border bg-muted/50">
                    <td colSpan={8} className="px-4 py-5">
                      <div className="grid gap-5 lg:grid-cols-2">
                        <dl className="space-y-2.5 text-[13px]">
                          <div className="flex gap-3">
                            <dt className="w-20 shrink-0 text-muted-foreground">职务</dt>
                            <dd className="text-[var(--color-ink-2)]">{r.role ?? '—'}</dd>
                          </div>
                          <div className="flex gap-3">
                            <dt className="w-20 shrink-0 text-muted-foreground">意向方向</dt>
                            <dd className="text-[var(--color-ink-2)]">
                              {r.subject_type ?? '—'}
                              {r.team_size != null && <span className="ml-2 text-[12px] text-muted-foreground">团队 {r.team_size} 人</span>}
                            </dd>
                          </div>
                          <div className="flex gap-3">
                            <dt className="w-20 shrink-0 text-muted-foreground">来源引用</dt>
                            <dd className="break-all text-[var(--color-ink-2)]">{r.source_ref ?? '—'}</dd>
                          </div>
                          <div className="flex gap-3">
                            <dt className="w-20 shrink-0 text-muted-foreground">UTM</dt>
                            <dd className="text-[var(--color-ink-2)]">
                              {r.utm && Object.keys(r.utm).length > 0 ? (
                                <span className="flex flex-wrap gap-1.5">
                                  {Object.entries(r.utm).map(([k, v]) => (
                                    <span key={k} className="rounded bg-card px-1.5 py-0.5 text-[11px] ring-1 ring-border">
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
                            <dt className="w-20 shrink-0 align-top text-muted-foreground">留言</dt>
                            <dd className="whitespace-pre-wrap leading-relaxed text-[var(--color-ink-2)]">{r.message ?? '—'}</dd>
                          </div>
                          <div className="flex gap-3">
                            <dt className="w-20 shrink-0 text-muted-foreground">更新时间</dt>
                            <dd className="text-[var(--color-ink-2)]">{fmtDate(r.updated_at)}</dd>
                          </div>
                        </dl>

                        <div>
                          <label
                            htmlFor={`note-${r.id}`}
                            className="block text-[12px] font-medium text-muted-foreground"
                          >
                            跟进备注
                          </label>
                          <Textarea
                            id={`note-${r.id}`}
                            value={noteDraft[r.id] ?? r.note ?? ''}
                            onChange={(e) => setNoteDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                            rows={5}
                            maxLength={2000}
                            placeholder="记录沟通进展、下一步动作…"
                            className="mt-2 text-[13px]"
                          />
                          <div className="mt-3 flex items-center gap-3">
                            <Button size="sm" onClick={() => saveNote(r.id)} disabled={savingId === r.id}>
                              {savingId === r.id ? '保存中…' : '保存备注'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeLead(r.id, r.name)}
                              disabled={savingId === r.id}
                              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              删除线索
                            </Button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </Card>
      {confirmDialog}
    </>
  );
}
