'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pickImageFile, uploadImageFile } from '@/lib/admin/upload-client';
import { Button } from '@/components/admin/ui/button';

/**
 * 媒体库「真实上传」入口：选图（可多选）→ 票据直传 Supabase Storage →
 * 自动登记 media_assets（path=对象 key、url=公开 URL、size=字节数）。
 *
 * 与「+ 登记资源」（手工登记外链）互补；上传成功后刷新列表。
 * 任一文件失败不影响其余文件，结束后汇总展示。
 */

type ItemState = { name: string; status: 'uploading' | 'done' | 'failed'; message?: string };

export default function MediaUploader() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ItemState[]>([]);
  const [error, setError] = useState('');

  function patch(name: string, patchValue: Partial<ItemState>) {
    setItems((prev) => prev.map((it) => (it.name === name ? { ...it, ...patchValue } : it)));
  }

  async function handleFiles(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setError('');
    setItems(files.map((f) => ({ name: f.name, status: 'uploading' as const })));

    let anySuccess = false;
    for (const file of files) {
      try {
        const uploaded = await uploadImageFile(file, 'media');
        const reg = await fetch('/api/admin/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // 媒体库 path 契约：站内绝对路径（/ 开头）；对象 key 是其去斜杠形式
            path: `/${uploaded.key}`,
            url: uploaded.url,
            kind: 'image',
            alt: '',
            size_bytes: uploaded.size,
          }),
        });
        const regData = (await reg.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
        if (!reg.ok || !regData?.ok) {
          patch(file.name, { status: 'failed', message: `已上传但登记失败：${regData?.message ?? reg.status}` });
        } else {
          anySuccess = true;
          patch(file.name, { status: 'done' });
        }
      } catch (err) {
        patch(file.name, {
          status: 'failed',
          message: err instanceof Error ? err.message : '上传失败',
        });
      }
    }

    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (anySuccess) router.refresh();
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
      >
        {busy ? '上传中…' : '⬆ 上传图片'}
      </Button>
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
      />
      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
      {items.length > 0 && (
        <ul className="mt-2 space-y-1 text-[12px]">
          {items.map((it) => (
            <li
              key={it.name}
              className={it.status === 'done' ? 'text-emerald-600' : it.status === 'failed' ? 'text-red-600' : 'text-[var(--color-ink-3)]'}
            >
              {it.status === 'uploading' ? '⏳' : it.status === 'done' ? '✓' : '✗'} {it.name}
              {it.message ? `：${it.message}` : ''}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
