'use client';

import clsx from 'clsx';
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

/**
 * 表单卡片：可选的标题头（title/desc）+ 字段区（保持 space-y-5 不变）。
 * 加标题头是为了双栏布局下「内容 / 发布设置」分区的语义可读——
 * 编辑者扫一眼就知道每张卡管什么。
 */
export function FormCard({
  title,
  desc,
  children,
  className,
}: {
  title?: string;
  desc?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'space-y-5 rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {title && (
        <div className="-mt-1 mb-1 border-b border-[var(--color-line)] pb-3">
          <h3 className="text-[14px] font-semibold text-[var(--color-brand-navy)]">{title}</h3>
          {desc && <p className="mt-0.5 text-[12px] text-[var(--color-ink-3)]">{desc}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/** id 供校验失败时的滚动定位（rf-global-error / nf-global-error）。 */
export function GlobalError({ msg, id }: { msg?: string; id?: string }) {
  if (!msg) return null;
  return (
    <p id={id} className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-600 ring-1 ring-red-100">
      {msg}
    </p>
  );
}

/** 主/次按钮的共享样式：与表单页各处的手写按钮保持同形，便于后续复用。 */
export const btnPrimary =
  'rounded-xl bg-[var(--color-brand-navy)] px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-3)] disabled:opacity-50';
export const btnGhost =
  'rounded-xl px-4 py-2.5 text-[14px] font-medium text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-brand-navy)] disabled:opacity-50';

/**
 * 吸底操作栏：常驻外壳后内容区（而非窗口）是滚动容器，sticky bottom-3
 * 让保存按钮始终贴在可视区底部，长表单不用滚回页脚找按钮。
 * 左侧提示脏状态（琥珀点）与 ⌘S 快捷键，右侧取消 + 提交。
 */
export function SubmitBar({
  busy,
  createLabel = '创建',
  editLabel = '保存修改',
  mode,
  onCancel,
  dirty = false,
  sticky = true,
  hint,
}: {
  busy: boolean;
  mode: 'create' | 'edit';
  createLabel?: string;
  editLabel?: string;
  onCancel: () => void;
  /** 有未保存修改时左侧显示琥珀色提醒点 */
  dirty?: boolean;
  /** 吸底（默认开）；内容很短、按钮不会滚出视口的场景可关掉 */
  sticky?: boolean;
  /** 自定义快捷键提示文案，默认「⌘/Ctrl + S 保存」 */
  hint?: string;
}) {
  return (
    <div
      data-testid="form-action-bar"
      className={clsx(
        'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--color-line)] bg-white/85 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-md',
        sticky && 'sticky bottom-3 z-20',
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {dirty && (
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-amber-700">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
            有未保存的修改
          </span>
        )}
        <span className="text-[12px] text-[var(--color-ink-3)]">{hint ?? '⌘/Ctrl + S 保存'}</span>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className={btnGhost}>
          取消
        </button>
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? '保存中…' : mode === 'create' ? createLabel : editLabel}
        </button>
      </div>
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
