'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import {
  NEWS_CATEGORIES,
  NEWS_STATUSES,
  autoSlug,
  newsStatusLabels,
  segmentsToHtml,
} from '@/lib/admin/news-schema';
import type { AdminNewsRow } from '@/lib/admin/data';
import RichTextEditor from '@/components/admin/RichTextEditor';
import ImageUploadField from '@/components/admin/ImageUploadField';
import { FieldError, FormCard, GlobalError, SubmitBar, inputClass, labelClass } from './crud/ui';
import { scrollToFirstError, useFormGuards } from './crud/use-form-guards';

/**
 * 新闻新建 / 编辑共用表单。
 * 正文编辑模型：一段一行（body 在库里是 jsonb 段落数组，与前台渲染同形）。
 *
 * 新闻与活动共用 news_posts 表（仅 category 不同）：
 * - 资讯 / 沙龙 → 出现在「新闻资讯」列表；
 * - 活动 → 出现在「活动管理」列表。
 * 从活动管理入口进来时传 presetCategory="活动"，保存后跳回活动列表。
 */

/** 落在「新闻资讯」列表的分类 / 落在「活动管理」列表的分类（从 schema 枚举派生，不重复声明）。 */
const NEWS_LIST_CATEGORIES = NEWS_CATEGORIES.filter((c) => c !== '活动');
const ACTIVITY_LIST_CATEGORIES = NEWS_CATEGORIES.filter((c) => c === '活动');

function isKnownCategory(v: string | undefined): boolean {
  return !!v && (NEWS_CATEGORIES as readonly string[]).includes(v);
}

type FormState = {
  title: string;
  slug: string;
  category: string;
  author: string;
  status: string;
  published_at: string;
  cover_url: string;
  summary: string;
  /** 富文本 HTML（编辑器输出；存量纯文本段在 initialState 里包 <p> 转换） */
  bodyHtml: string;
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialState(row?: AdminNewsRow, presetCategory?: string): FormState {
  const defaultCategory = presetCategory && isKnownCategory(presetCategory) ? presetCategory : '资讯';
  return {
    title: row?.title ?? '',
    slug: row?.slug ?? '',
    category: row?.category ?? defaultCategory,
    author: row?.author ?? '',
    status: row?.status ?? 'draft',
    published_at: row ? toLocalInput(row.published_at) : toLocalInput(new Date().toISOString()),
    cover_url: row?.cover_url ?? '',
    summary: row?.summary ?? '',
    bodyHtml: row ? segmentsToHtml(row.body) : '',
  };
}

/** 校验键 → 控件 id：bodyHtml 的编辑器容器是 nf-body，published_at / cover_url 的 id 是连字符短名 */
function idForErrorKey(key: string): string {
  if (key === 'bodyHtml') return 'nf-body';
  if (key === 'published_at') return 'nf-published-at';
  if (key === 'cover_url') return 'nf-cover';
  return `nf-${key}`;
}

export default function NewsForm({
  mode,
  row,
  presetCategory,
  redirectTo = '/admin/news',
}: {
  mode: 'create' | 'edit';
  row?: AdminNewsRow;
  /** 新建时预置的分类（如从活动管理入口进来的 "活动"）；不在枚举内则忽略。 */
  presetCategory?: string;
  /** 保存成功后的跳转目标（默认回新闻列表；活动入口传 /admin/activities）。 */
  redirectTo?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  // 初始快照存 ref：dirty 始终与「挂载时的原始值」比较，不随 re-render 漂移
  const initialRef = useRef<FormState>(initialState(row, presetCategory));
  const [form, setForm] = useState<FormState>(() => initialRef.current);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialRef.current),
    [form],
  );
  useFormGuards({ formRef, dirty, busy });

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
          bodyHtml: form.bodyHtml || '<p></p>',
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
        // 校验失败定位：等错误文案渲染后再滚动到第一个出错字段；
        // 只有全局错误（无字段错误）时退而滚动全局错误条。
        requestAnimationFrame(() => {
          const scrolled = scrollToFirstError(data?.errors ?? {}, 'nf-', idForErrorKey);
          if (!scrolled) {
            document.getElementById('nf-global-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        });
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setGlobalError('网络异常，请重试。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <FormCard title="正文内容" desc="标题、摘要与富文本正文">
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
            <span className="ml-2 font-normal text-[12px] text-[var(--color-ink-3)]">
              富文本：标题 / 加粗 / 列表 / 引用 / 链接 / 图片
            </span>
          </label>
          {/* id 挂在包裹层：RichTextEditor 不收 id，bodyHtml 校验失败时滚到这里定位 */}
          <div id="nf-body" className="mt-2">
            <RichTextEditor
              key={`${mode}-${row?.id ?? 'new'}`}
              value={form.bodyHtml}
              onChange={(html) => set('bodyHtml', html)}
            />
          </div>
          <FieldError msg={errors.bodyHtml} />
        </div>
      </FormCard>

      {/* 侧栏吸顶：滚动容器是内容区，top 参照外壳顶栏高度（带兜底） */}
      <div className="space-y-5 lg:sticky lg:self-start lg:top-[calc(var(--admin-topbar-h,56px)+1.5rem)]">
        <FormCard title="发布设置">
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
              <optgroup label="新闻资讯列表">
                {NEWS_LIST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
              <optgroup label="活动列表">
                {ACTIVITY_LIST_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="mt-1.5 text-[12px] text-[var(--color-ink-3)]">
              「{NEWS_LIST_CATEGORIES.join(' / ')}」出现在新闻资讯列表；「活动」出现在活动管理列表（共用同一内容池）。
            </p>
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
        </FormCard>

        <FormCard title="链接与封面">
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
              封面图（可选）
              <span className="ml-2 font-normal text-[12px] text-[var(--color-ink-3)]">
                上传直传对象存储，或粘贴外链
              </span>
            </label>
            <ImageUploadField
              id="nf-cover"
              value={form.cover_url}
              onChange={(url) => set('cover_url', url)}
              scene="covers"
              className="mt-2"
            />
            <FieldError msg={errors.cover_url} />
          </div>
        </FormCard>

        <GlobalError msg={globalError} id="nf-global-error" />
      </div>

      {/* 操作栏横跨两栏并吸底：内容区即滚动容器，sticky bottom-3 在其内生效 */}
      <div className="lg:col-span-2">
        <SubmitBar busy={busy} mode={mode} dirty={dirty} onCancel={() => router.back()} />
      </div>
    </form>
  );
}
