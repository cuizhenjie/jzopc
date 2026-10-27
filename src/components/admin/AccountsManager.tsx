'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminAccountRow } from '@/lib/admin/resources';
import { Badge } from '@/components/admin/ui/badge';
import { Button } from '@/components/admin/ui/button';
import { Card } from '@/components/admin/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/admin/ui/dialog';
import { Input } from '@/components/admin/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/admin/ui/table';
import { useConfirm } from '@/components/admin/ui/confirm';

/**
 * 管理员账号管理器：列表 + 新建 + 改显示名 / 重置密码 / 启停 / 删除。
 * 服务端 API 带「不能操作自己 / 不能动最后一个启用账号」守卫，前端同样禁用对应按钮。
 * 改显示名 / 重置密码走 Dialog 表单（替代 window.prompt）。
 */
export default function AccountsManager({
  rows,
  currentUid,
}: {
  rows: AdminAccountRow[];
  /** 当前登录账号的 uid（null = 主口令会话，不对应具体账号） */
  currentUid: number | null;
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<number | 'new' | null>(null);

  const [showCreate, setShowCreate] = useState(rows.length === 0);
  const [form, setForm] = useState({ username: '', display_name: '', password: '' });

  /** Dialog 行内操作：改显示名 / 重置密码 */
  const [prompt, setPrompt] = useState<{ type: 'display' | 'password'; row: AdminAccountRow; value: string } | null>(null);

  // 最后一个启用中的账号：不允许停用/删除
  const activeCount = rows.filter((r) => r.is_active).length;

  async function call(method: 'PATCH' | 'DELETE', body: Record<string, unknown> | null, id?: number) {
    setBusyId(id ?? 'new');
    setError('');
    setNotice('');
    const url = method === 'DELETE' ? `/api/admin/accounts?id=${id}` : '/api/admin/accounts';
    const res = await fetch(url, {
      method,
      headers: method === 'PATCH' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'PATCH' ? JSON.stringify(body) : undefined,
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
    if (res.ok && data?.ok) {
      router.refresh();
    } else {
      setError(data?.message ?? '操作失败，请重试。');
    }
    setBusyId(null);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusyId('new');
    setError('');
    setNotice('');
    const res = await fetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; errors?: Record<string, string> } | null;
    if (res.ok && data?.ok) {
      setForm({ username: '', display_name: '', password: '' });
      setShowCreate(false);
      setNotice('账号已创建。');
      router.refresh();
    } else {
      const fieldError = data?.errors ? Object.values(data.errors)[0] : undefined;
      setError(fieldError ?? data?.message ?? '创建失败，请重试。');
    }
    setBusyId(null);
  }

  function submitPrompt() {
    if (!prompt) return;
    const { type, row, value } = prompt;
    const v = value.trim();
    if (!v) return;
    if (type === 'display') call('PATCH', { id: row.id, display_name: v }, row.id);
    else call('PATCH', { id: row.id, password: v }, row.id);
    setPrompt(null);
  }

  function fmt(iso: string | null): string {
    if (!iso) return '从未登录';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="space-y-5">
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600 ring-1 ring-red-100">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700 ring-1 ring-emerald-100">{notice}</p>}

      <Card className="overflow-hidden">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>用户名</TableHead>
              <TableHead>显示名</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>最近登录</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const isSelf = currentUid === r.id;
              const lastActive = r.is_active && activeCount <= 1;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-[12px] text-foreground">
                    {r.username}
                    {isSelf && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">当前登录</span>}
                  </TableCell>
                  <TableCell className="text-[var(--color-ink-2)]">{r.display_name}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_active ? 'success' : 'secondary'} className={r.is_active ? undefined : 'bg-gray-100 text-gray-500 ring-gray-200'}>
                      {r.is_active ? '启用' : '停用'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmt(r.last_login_at)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPrompt({ type: 'display', row: r, value: r.display_name })}
                        disabled={busyId === r.id}
                        className="text-[var(--color-brand-blue-deep)]"
                      >
                        改显示名
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPrompt({ type: 'password', row: r, value: '' })}
                        disabled={busyId === r.id}
                      >
                        重置密码
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => call('PATCH', { id: r.id, is_active: !r.is_active }, r.id)}
                        disabled={busyId === r.id || isSelf || lastActive}
                        title={isSelf ? '不能停用当前登录账号' : lastActive ? '至少保留一个启用中的账号' : undefined}
                      >
                        {r.is_active ? '停用' : '启用'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const ok = await confirm({
                            title: `删除账号「${r.username}」`,
                            description: '不可恢复。',
                            actionLabel: '删除',
                            destructive: true,
                          });
                          if (ok) call('DELETE', null, r.id);
                        }}
                        disabled={busyId === r.id || isSelf || lastActive}
                        title={isSelf ? '不能删除当前登录账号' : lastActive ? '至少保留一个启用中的账号' : undefined}
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

      {showCreate ? (
        <form onSubmit={create}>
          <Card className="p-5">
            <p className="text-[13px] font-semibold text-[var(--color-brand-navy)]">新建管理员账号</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-[12px] text-[var(--color-ink-2)]">
              用户名
              <Input
                required
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                placeholder="ops / 3-32 位小写字母数字-_"
                className="mt-1 block w-52 font-mono"
              />
            </label>
            <label className="text-[12px] text-[var(--color-ink-2)]">
              显示名
              <Input
                required
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="运营同学"
                className="mt-1 block w-40"
              />
            </label>
            <label className="text-[12px] text-[var(--color-ink-2)]">
              初始密码
              <Input
                required
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="至少 8 位"
                className="mt-1 block w-44"
              />
            </label>
            <Button type="submit" disabled={busyId === 'new'}>
              {busyId === 'new' ? '创建中…' : '创建账号'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>
              取消
            </Button>
          </div>
            <p className="mt-3 text-[12px] text-muted-foreground">密码仅以 scrypt 哈希入库，创建后不可再查看；请通过「重置密码」下发新密码。</p>
          </Card>
        </form>
      ) : (
        <Button onClick={() => setShowCreate(true)}>+ 新建管理员账号</Button>
      )}

      {/* 行内操作弹窗：改显示名 / 重置密码 */}
      <Dialog open={prompt !== null} onOpenChange={(open) => !open && setPrompt(null)}>
        <DialogContent className="sm:max-w-sm">
          {prompt && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {prompt.type === 'display' ? `修改「${prompt.row.username}」的显示名` : `为「${prompt.row.username}」设置新密码`}
                </DialogTitle>
                <DialogDescription>
                  {prompt.type === 'display' ? '保存后立即生效。' : '至少 8 位；保存后旧密码立即失效。'}
                </DialogDescription>
              </DialogHeader>
              <Input
                autoFocus
                value={prompt.value}
                placeholder={prompt.type === 'password' ? '至少 8 位' : '显示名'}
                onChange={(e) => setPrompt((p) => (p ? { ...p, value: e.target.value } : p))}
                onKeyDown={(e) => e.key === 'Enter' && submitPrompt()}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setPrompt(null)}>
                  取消
                </Button>
                <Button onClick={submitPrompt} disabled={!prompt.value.trim()}>
                  保存
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
