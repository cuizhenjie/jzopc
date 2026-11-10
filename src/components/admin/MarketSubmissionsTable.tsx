'use client';

import { Fragment, useState } from 'react';
import {
  LEAD_STATUSES,
  leadStatusLabels,
  type AdminLeadRow,
} from '@/lib/admin/data';
import {
  parseMarketFormPayload,
  type MarketFormKind,
} from '@/lib/opc/form-payload';
import { Badge } from '@/components/admin/ui/badge';
import { Button } from '@/components/admin/ui/button';
import { Card } from '@/components/admin/ui/card';
import { Empty } from '@/components/admin/ui/empty';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/admin/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/admin/ui/table';
import { fmtDate } from './crud/ui';

/**
 * 供需数据表格：/market 前台「发布需求 / 发布能力」表单的提交记录。
 *
 * 数据即线索池里的 lead_type='market' 记录（source_ref=market:need/give），
 * 与线索列表同源；区别在信息架构——这里按供需表单的字段结构化展示：
 *   - 列表行：类型 / 机构 / 一句话说明 / 联系人 / 提交时间 / 跟进状态；
 *   - 展开行：表单原始字段（需求详情、供给产品、预算、公开范围…）+ 原始文案；
 *   - 跟进状态直接改（复用 /api/admin/leads/[id]，与线索列表同一写路径），
 *     备注维护留在线索列表。
 *
 * 2026-11-10 前的旧数据没有 form_payload 列，展开行回退为 message 原文展示。
 */

const KIND_LABEL: Record<MarketFormKind, string> = { need: '需求', give: '能力' };

const KIND_BADGE: Record<MarketFormKind, string> = {
  need: 'bg-orange-50 text-orange-700 ring-orange-200',
  give: 'bg-violet-50 text-violet-700 ring-violet-200',
};

/** 来源判定优先看 DB 的 source_ref（老数据也有），其次才是 form_payload。 */
function kindOf(row: AdminLeadRow): MarketFormKind | null {
  if (row.source_ref === 'market:need') return 'need';
  if (row.source_ref === 'market:give') return 'give';
  return parseMarketFormPayload(row.form_payload)?.kind ?? null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap text-[var(--color-ink-2)]">{children}</dd>
    </div>
  );
}

export default function MarketSubmissionsTable({ rows }: { rows: AdminLeadRow[] }) {
  const [list, setList] = useState(rows);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  // 外层数据刷新后 rows 变化，渲染期同步本地态（与 LeadsTable 同一模式）
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setList(rows);
  }

  async function updateStatus(id: number, status: string) {
    setError('');
    setSavingId(id);
    const prev = list;
    setList((l) => l.map((r) => (r.id === id ? { ...r, status } : r)));
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setList(prev);
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(data?.message ?? '操作失败，请重试。');
    }
    setSavingId(null);
  }

  if (list.length === 0) {
    return (
      <Empty
        title="暂无供需提交"
        description={
          <>
            /market 前台的「发布需求 / 发布能力」表单提交后会自动出现在这里。
            若已提交但看不到，请检查 Supabase 连接与
            <code className="mx-1 rounded bg-secondary px-1.5 py-0.5 text-[12px]">leads</code>
            表配置。
          </>
        }
      />
    );
  }

  return (
    <Card className="overflow-hidden">
      {error && (
        <p className="border-b border-red-100 bg-red-50 px-4 py-2.5 text-[13px] text-red-600">{error}</p>
      )}
      <Table className="min-w-[960px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>类型</TableHead>
            <TableHead>机构</TableHead>
            <TableHead>一句话说明</TableHead>
            <TableHead>联系人</TableHead>
            <TableHead>提交时间</TableHead>
            <TableHead>跟进状态</TableHead>
            <TableHead aria-label="操作" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((r) => {
            const kind = kindOf(r);
            const payload = parseMarketFormPayload(r.form_payload);
            return (
              <Fragment key={r.id}>
                <TableRow
                  data-state={expanded === r.id ? 'selected' : undefined}
                  className={expanded === r.id ? 'bg-muted/60' : undefined}
                >
                  <TableCell>
                    {kind ? (
                      <Badge className={KIND_BADGE[kind]}>{KIND_LABEL[kind]}</Badge>
                    ) : (
                      <Badge variant="secondary">{r.source_ref ?? '—'}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {payload?.values.org || r.org_name || '—'}
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <p className="truncate text-[var(--color-ink-2)]">
                      {payload?.values.oneline || '—'}
                    </p>
                  </TableCell>
                  <TableCell className="text-[var(--color-ink-2)]">
                    {r.name}
                    <span className="ml-1.5 text-[11px] text-muted-foreground">{r.contact}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(r.created_at)}</TableCell>
                  <TableCell>
                    <Select
                      value={r.status}
                      onValueChange={(v) => updateStatus(r.id, v)}
                      disabled={savingId === r.id}
                    >
                      <SelectTrigger
                        size="sm"
                        aria-label={`更新 ${r.name} 的跟进状态`}
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
                    <td colSpan={7} className="px-4 py-5">
                      {payload ? (
                        <dl className="grid gap-x-8 gap-y-2.5 text-[13px] lg:grid-cols-2">
                          {payload.kind === 'need' ? (
                            <>
                              <Field label="需求类型">{payload.values.needTypes.join(' / ') || '—'}</Field>
                              <Field label="预算 / 方式">{payload.values.budget || '—'}</Field>
                              <Field label="需求详情">{payload.values.detail || '—'}</Field>
                              <Field label="期望时间">{payload.values.when || '—'}</Field>
                            </>
                          ) : (
                            <>
                              <Field label="供给类型">{payload.values.giveTypes.join(' / ') || '—'}</Field>
                              <Field label="合作方式">
                                {[payload.values.giveWays.join(' / '), payload.values.price].filter(Boolean).join('｜') || '—'}
                              </Field>
                              <Field label="产品与适合谁">{payload.values.product || '—'}</Field>
                              <Field label="合作边界">{payload.values.boundary || '—'}</Field>
                              <Field label="可响应时间">{payload.values.when || '—'}</Field>
                            </>
                          )}
                          <Field label="公开范围">{payload.values.scope || '—'}</Field>
                          <Field label="联系人">{`${payload.values.contact || r.name} ${payload.values.tel || r.contact}`}</Field>
                        </dl>
                      ) : (
                        <p className="text-[13px] text-muted-foreground">
                          该提交无结构化表单数据（旧数据），以下为原始文案：
                        </p>
                      )}
                      {r.message && (
                        <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-border bg-card p-4 text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                          {r.message}
                        </pre>
                      )}
                      {r.note && (
                        <p className="mt-3 text-[13px] text-muted-foreground">
                          备注（在线索列表维护）：{r.note}
                        </p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
