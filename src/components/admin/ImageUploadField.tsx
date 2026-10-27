'use client';

import { useRef, useState } from 'react';
import { uploadImageFile } from '@/lib/admin/upload-client';
import { Button } from '@/components/admin/ui/button';
import { Input } from '@/components/admin/ui/input';

/**
 * 图片字段：URL 输入 + 直传按钮 + 缩略预览。
 *
 * 统一供 NewsForm 封面、ResourceForm 的 image 字段使用：
 * - 上传走 /api/admin/uploads 票据 + 浏览器直传 Supabase Storage；
 * - 未配置上传（接口 503）时按钮提示，粘贴外链 URL 的老用法保留。
 */

export default function ImageUploadField({
  id,
  value,
  onChange,
  scene,
  placeholder = 'https://… 可上传或粘贴外链',
  className = '',
}: {
  id?: string;
  value: string;
  onChange: (url: string) => void;
  /** 上传场景（对象 key 顶层目录）：covers / body / media */
  scene: string;
  placeholder?: string;
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const uploaded = await uploadImageFile(file, scene);
      onChange(uploaded.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试。');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className={className}>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setError('');
          }}
          placeholder={placeholder}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="shrink-0 self-center"
        >
          {busy ? '上传中…' : '上传图片'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="mt-1.5 text-[12px] text-red-600">{error}</p>}
      {value && !error && (
        // eslint-disable-next-line @next/next/no-img-element -- 后台表单预览任意外链/上传 URL，不走 next/image 优化
        <img
          src={value}
          alt="预览"
          className="mt-2 h-24 w-auto max-w-full rounded-lg border border-border object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
          onLoad={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = '';
          }}
        />
      )}
    </div>
  );
}
