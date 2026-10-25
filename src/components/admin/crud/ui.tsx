'use client';

import { useState, type ReactNode } from 'react';

/**
 * 管理后台 CRUD 表单的共享原语（从 NewsForm 的既有样式提取，
 * 新模块表单统一从这里取，保证视觉一致）。
 *
 * 页面模板参考 CRMEB 后台的「列表页 + 筛选栏 + 表格 + 表单页」范式，
 * 用 jizhi 既有设计 token 实现。
 */

export const inputClass =
  'w-full rounded-xl border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-brand-blue)]';
export const labelClass = 'block text-[13px] font-medium text-[var(--color-ink-2)]';

export function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1.5 text-[12px] text-red-600">{msg}</p>;
}

export function Field({
  label,
  required,
  hint,
  htmlFor,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="ml-2 font-normal text-[12px] text-[var(--color-ink-3)]">{hint}</span>}
      </label>
      <div className="mt-2">{children}</div>
      <FieldError msg={error} />
    </div>
  );
}

export function FormCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`space-y-5 rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </div>
  );
}

export function GlobalError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600 ring-1 ring-red-100">{msg}</p>
  );
}

export function SubmitBar({
  busy,
  createLabel = '创建',
  editLabel = '保存修改',
  mode,
  onCancel,
}: {
  busy: boolean;
  mode: 'create' | 'edit';
  createLabel?: string;
  editLabel?: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-[var(--color-brand-navy)] px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-3)] disabled:opacity-50"
      >
        {busy ? '保存中…' : mode === 'create' ? createLabel : editLabel}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-xl px-4 py-2.5 text-[14px] font-medium text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-brand-navy)] disabled:opacity-50"
      >
        取消
      </button>
    </div>
  );
}

/**
 * 标签输入：逗号分隔文本 ↔ string[]。
 * 库里的 tags / related 都是 text[]，UI 上按「逗号或空格分隔」录入。
 */
export function TagInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value.join(', '));
  return (
    <input
      id={id}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split(/[,，\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
      placeholder={placeholder ?? '多个标签用逗号分隔'}
      className={inputClass}
    />
  );
}

/** 上下架徽标（published 布尔口径的模块共用）。 */
export const publishedBadge = (published: boolean) =>
  published
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200';

export function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ${className}`}>{children}</span>;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
