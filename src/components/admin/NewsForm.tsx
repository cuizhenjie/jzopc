'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { NEWS_CATEGORIES, NEWS_STATUSES, autoSlug, newsStatusLabels } from '@/lib/admin/news-schema';
import type { AdminNewsRow } from '@/lib/admin/data';

/**
 * 新闻新建 / 编辑共用表单。
 * 正文编辑模型：一段一行（body 在库里是 jsonb 段落数组，与前台渲染同形）。
 */

type FormState = {
  title: string;
  slug: string;
  category: string;
  author: string;
  status: string;
  published_at: string;
  cover_url: string;
  summary: string;
  bodyText: string;
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialState(row?: AdminNewsRow): FormState {
  return {
    title: row?.title ?? '',
    slug: row?.slug ?? '',
    category: row?.category ?? '资讯',
    author: row?.author ?? '',
    status: row?.status ?? 'draft',
    published_at: row ? toLocalInput(row.published_at) : toLocalInput(new Date().toISOString()),
    cover_url: row?.cover_url ?? '',
    summary: row?.summary ?? '',
    bodyText: row ? row.body.join('\n') : '',
  };
}

const inputClass =
  'w-full rounded-xl border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-brand-blue)]';
const labelClass = 'block text-[13px] font-medium text-[var(--color-ink-2)]';

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1.5 text-[12px] text-red-600">{msg}</p>;
}

export default function NewsForm({ mode, row }: { mode: 'create' | 'edit'; row?: AdminNewsRow }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => initialState(row));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState('');

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setGlobalError('');

    try {
      const res = await fetch(mode === 'create' ? '/api/admin/news' : `/api/admin/news/${row?.id}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          slug: form.slug.trim() || (mode === 'create' ? autoSlug() : form.slug),
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        errors?: Record<string, string>;
      } | null;

      if (!res.ok || !data?.ok) {
        setErrors(data?.errors ?? {});
        setGlobalError(data?.message ?? '保存失败，请重试。');
        return;
      }

      router.push('/admin/news');
      router.refresh();
    } catch {
      setGlobalError('网络异常，请重试。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5 rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-card)]">
        <div>
          <label htmlFor="nf-title" className={labelClass}>
            标题 <span className="text-red-500">*</span>
          </label>
          <input
            id="nf-title"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            maxLength={120}
            placeholder="例：集智第 3 期 AI 沙龙回顾"
            className={`mt-2 ${inputClass}`}
          />
          <FieldError msg={errors.title} />
        </div>

        <div>
          <label htmlFor="nf-summary" className={labelClass}>
            摘要 <span className="text-red-500">*</span>
          </label>
          <textarea
            id="nf-summary"
            value={form.summary}
            onChange={(e) => set('summary', e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="一句话概括，显示在列表卡片与分享卡片上（≤200 字）"
            className={`mt-2 ${inputClass}`}
          />
          <FieldError msg={errors.summary} />
        </div>

        <div>
          <label htmlFor="nf-body" className={labelClass}>
            正文 <span className="text-red-500">*</span>
            <span className="ml-2 font-normal text-[12px] text-[var(--color-ink-3)]">一段一行，空行会被忽略</span>
          </label>
          <textarea
            id="nf-body"
            value={form.bodyText}
            onChange={(e) => set('bodyText', e.target.value)}
            rows={14}
            placeholder={'第一段……\n第二段……'}
            className={`mt-2 ${inputClass} leading-[1.9]`}
          />
          <FieldError msg={errors.bodyText} />
        </div>
      </div>

      <div className="space-y-5">
        <div className="space-y-5 rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-card)]">
          <div>
            <label htmlFor="nf-status" className={labelClass}>
              状态
            </label>
            <select
              id="nf-status"
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              className={`mt-2 ${inputClass}`}
            >
              {NEWS_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {newsStatusLabels[s]}
                  {s === 'draft' ? '（前台不可见）' : s === 'archived' ? '（详情页 404）' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="nf-category" className={labelClass}>
              分类 <span className="text-red-500">*</span>
            </label>
            <select
              id="nf-category"
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className={`mt-2 ${inputClass}`}
            >
              {NEWS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <FieldError msg={errors.category} />
          </div>

          <div>
            <label htmlFor="nf-published-at" className={labelClass}>
              发布时间
            </label>
            <input
              id="nf-published-at"
              type="datetime-local"
              value={form.published_at}
              onChange={(e) => set('published_at', e.target.value)}
              className={`mt-2 ${inputClass}`}
            />
            <FieldError msg={errors.published_at} />
          </div>

          <div>
            <label htmlFor="nf-author" className={labelClass}>
              作者
            </label>
            <input
              id="nf-author"
              value={form.author}
              onChange={(e) => set('author', e.target.value)}
              maxLength={40}
              placeholder="集智运营团队"
              className={`mt-2 ${inputClass}`}
            />
          </div>
        </div>

        <div className="space-y-5 rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-card)]">
          <div>
            <label htmlFor="nf-slug" className={labelClass}>
              Slug（URL 路径）
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="nf-slug"
                value={form.slug}
                onChange={(e) => set('slug', e.target.value.toLowerCase())}
                placeholder="留空自动生成"
                className={inputClass}
              />
              {mode === 'create' && (
                <button
                  type="button"
                  onClick={() => set('slug', autoSlug())}
                  className="shrink-0 rounded-xl bg-[var(--color-surface-2)] px-3 text-[12px] font-medium text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-brand-navy)]"
                >
                  生成
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[12px] text-[var(--color-ink-3)]">
              前台地址：/news/{form.slug || '…'}（小写字母/数字/中划线）
            </p>
            <FieldError msg={errors.slug} />
          </div>

          <div>
            <label htmlFor="nf-cover" className={labelClass}>
              封面图链接（可选）
            </label>
            <input
              id="nf-cover"
              value={form.cover_url}
              onChange={(e) => set('cover_url', e.target.value)}
              placeholder="https://…"
              className={`mt-2 ${inputClass}`}
            />
            <FieldError msg={errors.cover_url} />
          </div>
        </div>

        {globalError && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600 ring-1 ring-red-100">{globalError}</p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-[var(--color-brand-navy)] px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-3)] disabled:opacity-50"
          >
            {busy ? '保存中…' : mode === 'create' ? '创建' : '保存修改'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={busy}
            className="rounded-xl px-4 py-2.5 text-[14px] font-medium text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-brand-navy)] disabled:opacity-50"
          >
            取消
          </button>
        </div>
      </div>
    </form>
  );
}
