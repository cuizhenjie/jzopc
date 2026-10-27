'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import RichTextEditor from '@/components/admin/RichTextEditor';
import ImageUploadField from '@/components/admin/ImageUploadField';
import { useFormGuards, scrollToFirstError } from './use-form-guards';
import {
  Field,
  FieldError,
  FormCard,
  GlobalError,
  SubmitBar,
  TagInput,
  inputClass,
} from './ui';

/**
 * 配置驱动的资源表单（8 个规划中模块共用）。
 *
 * 字段配置来自 src/lib/admin/resource-configs.ts（与 zod schema 同源维护），
 * 新模块接入 = 写一份字段配置 + 一行路由装配，不再复制 NewsForm。
 * image 类型 = URL 输入 + 直传按钮（/api/admin/uploads 票据 + 浏览器 PUT）。
 */

export type ResourceFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'tags'
  | 'switch'
  | 'richtext'
  | 'json'
  | 'datetime'
  | 'image';

export type ResourceFieldConfig = {
  name: string;
  label: string;
  type: ResourceFieldType;
  required?: boolean;
  max?: number;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  /** 布局：2 = 独占整行（默认单列卡内即整行） */
  full?: boolean;
  rows?: number;
  /** image 类型：上传场景目录（covers / body / media），默认 media */
  uploadScene?: string;
};

export type ResourceFormValues = Record<string, string | number | boolean | string[]>;

/** 提交前的类型归一：number 字段转数字，tags/json 保持字符串形态交给 zod coerce */
function normalizeSubmit(values: ResourceFormValues, fields: ResourceFieldConfig[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = values[f.name];
    if (f.type === 'number') {
      out[f.name] = v === '' || v === null || v === undefined ? 0 : Number(v);
    } else {
      out[f.name] = v;
    }
  }
  return out;
}

export default function ResourceForm({
  mode,
  fields,
  initial,
  apiBase,
  /** 编辑目标的 pk 段（id 或 slug）；create 时不传 */
  pkValue,
  redirectTo,
  createLabel = '创建',
  editLabel = '保存修改',
  conflictMessage,
}: {
  mode: 'create' | 'edit';
  fields: ResourceFieldConfig[];
  initial: ResourceFormValues;
  apiBase: string;
  pkValue?: string | number;
  redirectTo: string;
  createLabel?: string;
  editLabel?: string;
  conflictMessage?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<ResourceFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [globalError, setGlobalError] = useState('');

  // 脏检测用 JSON 快照对比：values 的键序来自 initial、set() 展开保持不变，
  // 序列化稳定且对 string[]/boolean/number 都成立，无需逐字段手写比较。
  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initial),
    [values, initial],
  );
  useFormGuards({ formRef, dirty, busy });

  function set(name: string, v: ResourceFormValues[string]) {
    setValues((prev) => ({ ...prev, [name]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErrors({});
    setGlobalError('');

    try {
      const res = await fetch(mode === 'create' ? apiBase : `${apiBase}/${pkValue}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizeSubmit(values, fields)),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        errors?: Record<string, string>;
      } | null;

      if (!res.ok || !data?.ok) {
        setErrors(data?.errors ?? {});
        setGlobalError(data?.message ?? '保存失败，请重试。');
        // 校验失败定位：等 React 渲染出错误文案节点后再滚动，
        // 字段 id 统一为 rf-${name}；没有字段错误时退而滚动全局错误条。
        requestAnimationFrame(() => {
          const scrolled = scrollToFirstError(data?.errors ?? {}, 'rf-');
          if (!scrolled) {
            document.getElementById('rf-global-error')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
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

  const mainFields = fields.filter((f) => !f.full);
  const sideFields = fields.filter((f) => f.full);

  function renderControl(f: ResourceFieldConfig) {
    const v = values[f.name];
    switch (f.type) {
      case 'textarea':
        return (
          <textarea
            id={`rf-${f.name}`}
            value={String(v ?? '')}
            onChange={(e) => set(f.name, e.target.value)}
            rows={f.rows ?? 4}
            maxLength={f.max}
            placeholder={f.placeholder}
            className={`${inputClass} leading-[1.8]`}
          />
        );
      case 'number':
        return (
          <input
            id={`rf-${f.name}`}
            type="number"
            value={String(v ?? 0)}
            onChange={(e) => set(f.name, e.target.value === '' ? 0 : Number(e.target.value))}
            min={0}
            className={inputClass}
          />
        );
      case 'select':
        return (
          <select id={`rf-${f.name}`} value={String(v ?? '')} onChange={(e) => set(f.name, e.target.value)} className={inputClass}>
            {(f.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        );
      case 'tags':
        return <TagInput id={`rf-${f.name}`} value={(v as string[]) ?? []} onChange={(arr) => set(f.name, arr)} placeholder={f.placeholder} />;
      case 'switch':
        return (
          <label className="inline-flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--color-ink-2)]">
            <input
              id={`rf-${f.name}`}
              type="checkbox"
              checked={Boolean(v)}
              onChange={(e) => set(f.name, e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-line)] accent-[var(--color-brand-navy)]"
            />
            {Boolean(v) ? '开启' : '关闭'}
          </label>
        );
      case 'richtext':
        return (
          <RichTextEditor
            key={f.name}
            value={String(v ?? '')}
            onChange={(html) => set(f.name, html)}
            placeholder={f.placeholder}
          />
        );
      case 'image':
        return (
          <ImageUploadField
            id={`rf-${f.name}`}
            value={String(v ?? '')}
            onChange={(url) => set(f.name, url)}
            scene={f.uploadScene ?? 'media'}
            placeholder={f.placeholder}
          />
        );
      case 'json':
        return (
          <textarea
            id={`rf-${f.name}`}
            value={String(v ?? '')}
            onChange={(e) => set(f.name, e.target.value)}
            rows={f.rows ?? 4}
            placeholder={f.placeholder ?? 'JSON 数组/对象；留空表示空'}
            className={`${inputClass} font-mono text-[12px] leading-[1.7]`}
          />
        );
      case 'datetime':
        return (
          <input
            id={`rf-${f.name}`}
            type="datetime-local"
            value={String(v ?? '')}
            onChange={(e) => set(f.name, e.target.value)}
            className={inputClass}
          />
        );
      default:
        return (
          <input
            id={`rf-${f.name}`}
            value={String(v ?? '')}
            onChange={(e) => set(f.name, e.target.value)}
            maxLength={f.max}
            placeholder={f.placeholder}
            className={inputClass}
          />
        );
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <FormCard title="内容" desc="正文与主要字段">
        {mainFields.map((f) => (
          <Field
            key={f.name}
            label={f.label}
            required={f.required}
            hint={f.hint}
            htmlFor={`rf-${f.name}`}
            error={errors[f.name]}
          >
            {renderControl(f)}
          </Field>
        ))}
      </FormCard>

      {/* 侧栏吸顶：滚动容器是内容区，top 参照外壳顶栏高度（带兜底） */}
      <div className="space-y-5 lg:sticky lg:self-start lg:top-[calc(var(--admin-topbar-h,56px)+1.5rem)]">
        {sideFields.length > 0 && (
          <FormCard title="发布设置" desc="状态、排序与展示控制">
            {sideFields.map((f) => (
              <Field
                key={f.name}
                label={f.label}
                required={f.required}
                hint={f.hint}
                htmlFor={`rf-${f.name}`}
                error={errors[f.name]}
              >
                {renderControl(f)}
              </Field>
            ))}
          </FormCard>
        )}

        <GlobalError msg={globalError} id="rf-global-error" />
      </div>

      {/* 操作栏横跨两栏并吸底：内容区即滚动容器，sticky bottom-3 在其内生效 */}
      <div className="lg:col-span-2">
        <SubmitBar
          busy={busy}
          mode={mode}
          createLabel={createLabel}
          editLabel={editLabel}
          dirty={dirty}
          onCancel={() => router.push(redirectTo)}
        />
      </div>
    </form>
  );
}
