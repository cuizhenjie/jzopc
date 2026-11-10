'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminHomeBannerRow } from '@/lib/admin/resources';
import ImageUploadField from '@/components/admin/ImageUploadField';
import { Button } from '@/components/admin/ui/button';
import { Card } from '@/components/admin/ui/card';
import { Input } from '@/components/admin/ui/input';
import { Switch } from '@/components/admin/ui/switch';
import { useConfirm } from '@/components/admin/ui/confirm';

type BannerDraft = {
  image_url: string;
  alt: string;
  sort_order: number;
  published: boolean;
};

type ApiResult = { ok?: boolean; message?: string; errors?: Record<string, string> };

const EMPTY_DRAFT: BannerDraft = { image_url: '', alt: '', sort_order: 0, published: true };

function toDraft(row: AdminHomeBannerRow): BannerDraft {
  return {
    image_url: row.image_url,
    alt: row.alt,
    sort_order: row.sort_order,
    published: row.published,
  };
}

function sameDraft(a: BannerDraft, b: BannerDraft): boolean {
  return a.image_url === b.image_url && a.alt === b.alt && a.sort_order === b.sort_order && a.published === b.published;
}

function firstError(data: ApiResult | null, fallback: string): string {
  const fieldError = data?.errors ? Object.values(data.errors)[0] : undefined;
  return fieldError ?? data?.message ?? fallback;
}

/**
 * 首页首屏 Banner 维护。每张图一张卡片：上传或粘贴地址、替代文本、排序、是否发布。
 * 保存走资源接口全量更新，成功后首页轮播按已发布行重绘。
 */
export default function HomeBannersManager({ rows }: { rows: AdminHomeBannerRow[] }) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [drafts, setDrafts] = useState<Record<number, BannerDraft>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, toDraft(row)])),
  );
  const [busyId, setBusyId] = useState<number | 'new' | null>(null);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState<number | null>(null);
  const [creating, setCreating] = useState<BannerDraft>(EMPTY_DRAFT);

  function update(id: number, patch: Partial<BannerDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? EMPTY_DRAFT), ...patch } }));
  }

  async function save(id: number) {
    const draft = drafts[id];
    if (!draft) return;
    setBusyId(id);
    setError('');
    setSavedId(null);
    const res = await fetch(`/api/admin/banners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    const data = (await res.json().catch(() => null)) as ApiResult | null;
    if (res.ok && data?.ok) {
      setSavedId(id);
      router.refresh();
    } else {
      setError(firstError(data, '保存失败，请重试。'));
    }
    setBusyId(null);
  }

  async function remove(row: AdminHomeBannerRow) {
    const ok = await confirm({
      title: `删除这张 Banner`,
      description: row.alt ? `「${row.alt}」将从首页轮播中移除。` : '删除后这张图不再出现在首页轮播。',
      actionLabel: '删除',
      destructive: true,
    });
    if (!ok) return;
    setBusyId(row.id);
    setError('');
    const res = await fetch(`/api/admin/banners/${row.id}`, { method: 'DELETE' });
    const data = (await res.json().catch(() => null)) as ApiResult | null;
    if (res.ok && data?.ok) {
      router.refresh();
    } else {
      setError(firstError(data, '删除失败，请重试。'));
    }
    setBusyId(null);
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusyId('new');
    setError('');
    const res = await fetch('/api/admin/banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creating),
    });
    const data = (await res.json().catch(() => null)) as ApiResult | null;
    if (res.ok && data?.ok) {
      setCreating(EMPTY_DRAFT);
      router.refresh();
    } else {
      setError(firstError(data, '创建失败，请重试。'));
    }
    setBusyId(null);
  }

  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-6 text-muted-foreground">
        图片作为首页首屏背景轮播，建议横图、主体居中。只展示已发布的图，排序数字小的在前。底部步骤条和左右切换由前台自动生成。
      </p>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600 ring-1 ring-red-100">{error}</p>}

      {rows.length === 0 && (
        <Card className="px-5 py-10 text-center text-[13px] text-muted-foreground">
          还没有 Banner。在下方添加第一张，发布后首页首屏就会换成这张图。
        </Card>
      )}

      {rows.map((row) => {
        const draft = drafts[row.id] ?? toDraft(row);
        const dirty = !sameDraft(draft, toDraft(row));
        const busy = busyId === row.id;
        return (
          <Card key={row.id} className="p-5">
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <ImageUploadField
                id={`banner-image-${row.id}`}
                value={draft.image_url}
                onChange={(url) => update(row.id, { image_url: url })}
                scene="covers"
                placeholder="/opc/… 或 https://…"
              />
              <div className="space-y-3">
                <label className="block text-[12px] text-[var(--color-ink-2)]" htmlFor={`banner-alt-${row.id}`}>
                  替代文本
                  <Input
                    id={`banner-alt-${row.id}`}
                    value={draft.alt}
                    maxLength={80}
                    onChange={(event) => update(row.id, { alt: event.target.value })}
                    placeholder="描述这张图里的场景"
                    className="mt-1"
                  />
                </label>
                <div className="flex flex-wrap items-end gap-4">
                  <label className="text-[12px] text-[var(--color-ink-2)]" htmlFor={`banner-sort-${row.id}`}>
                    排序
                    <Input
                      id={`banner-sort-${row.id}`}
                      type="number"
                      min={0}
                      max={9999}
                      value={draft.sort_order}
                      onChange={(event) => update(row.id, { sort_order: Number(event.target.value) })}
                      className="mt-1 block w-24"
                    />
                  </label>
                  <div className="flex items-center gap-2 pb-2">
                    <Switch
                      checked={draft.published}
                      onCheckedChange={(checked) => update(row.id, { published: checked })}
                      id={`banner-pub-${row.id}`}
                    />
                    <label htmlFor={`banner-pub-${row.id}`} className="text-[12px] text-[var(--color-ink-2)]">
                      {draft.published ? '已发布' : '未发布'}
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => save(row.id)} disabled={busy || !dirty}>
                    {busy ? '保存中…' : savedId === row.id && !dirty ? '已保存' : '保存'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(row)}
                    disabled={busy}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    删除
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        );
      })}

      <Card className="p-5">
        <p className="text-[13px] font-semibold text-[var(--color-brand-navy)]">新增 Banner</p>
        <form className="mt-3 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]" onSubmit={create}>
          <ImageUploadField
            id="banner-image-new"
            value={creating.image_url}
            onChange={(url) => setCreating((current) => ({ ...current, image_url: url }))}
            scene="covers"
            placeholder="/opc/… 或 https://…"
          />
          <div className="space-y-3">
            <label className="block text-[12px] text-[var(--color-ink-2)]" htmlFor="banner-alt-new">
              替代文本
              <Input
                id="banner-alt-new"
                required
                value={creating.alt}
                maxLength={80}
                onChange={(event) => setCreating((current) => ({ ...current, alt: event.target.value }))}
                placeholder="描述这张图里的场景"
                className="mt-1"
              />
            </label>
            <div className="flex flex-wrap items-end gap-4">
              <label className="text-[12px] text-[var(--color-ink-2)]" htmlFor="banner-sort-new">
                排序
                <Input
                  id="banner-sort-new"
                  type="number"
                  min={0}
                  max={9999}
                  value={creating.sort_order}
                  onChange={(event) => setCreating((current) => ({ ...current, sort_order: Number(event.target.value) }))}
                  className="mt-1 block w-24"
                />
              </label>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={creating.published}
                  onCheckedChange={(checked) => setCreating((current) => ({ ...current, published: checked }))}
                  id="banner-pub-new"
                />
                <label htmlFor="banner-pub-new" className="text-[12px] text-[var(--color-ink-2)]">
                  {creating.published ? '已发布' : '未发布'}
                </label>
              </div>
            </div>
            <Button type="submit" disabled={busyId === 'new'}>
              {busyId === 'new' ? '创建中…' : '添加'}
            </Button>
          </div>
        </form>
      </Card>
      {confirmDialog}
    </div>
  );
}
