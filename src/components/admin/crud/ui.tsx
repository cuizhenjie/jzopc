'use client';

import { useState, type ReactNode } from 'react';

import { Badge as ShadcnBadge } from '@/components/admin/ui/badge';
import { Button } from '@/components/admin/ui/button';
import { Card } from '@/components/admin/ui/card';
import { Input, inputClass } from '@/components/admin/ui/input';
import { Label } from '@/components/admin/ui/label';
import { cn } from '@/lib/utils';

/**
 * 管理后台 CRUD 表单的共享原语 —— 2026-10 起 底座切换为 shadcn/ui 组件
 * （src/components/admin/ui/*），对外 API 保持不变：
 * NewsForm / ResourceForm / ImageUploadField / resource-tables 均从这里取，
 * 保证视觉一致。页面模板参考 opendesign CMS 后台的
 * 「列表页 + 筛选栏 + 表格 + 双栏表单页」范式。
 */

export { inputClass };
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
      <Label htmlFor={htmlFor} className={cn(labelClass, 'block')}>
        {label} {required && <span className="text-red-500">*</span>}
        {hint && <span className="ml-2 font-normal text-[12px] text-[var(--color-ink-3)]">{hint}</span>}
      </Label>
      <div className="mt-2">{children}</div>
      <FieldError msg={error} />
    </div>
  );
}

/**
 * 表单卡片：可选的标题头（title/desc）+ 字段区（保持 space-y-5 不变）。
 * 双栏布局下「内容 / 发布设置」分区的语义可读——编辑者扫一眼就知道每张卡管什么。
 * 底座为 shadcn Card（rounded-2xl / border / shadow-card）。
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
    <Card className={cn('space-y-5 p-6', className)}>
      {title && (
        <div className="-mt-1 mb-1 border-b border-border pb-3">
          <h3 className="text-[14px] font-semibold text-[var(--color-brand-navy)]">{title}</h3>
          {desc && <p className="mt-0.5 text-[12px] text-muted-foreground">{desc}</p>}
        </div>
      )}
      {children}
    </Card>
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

/**
 * 吸底操作栏：常驻外壳后内容区（而非窗口）是滚动容器，sticky bottom-3
 * 让保存按钮始终贴在可视区底部，长表单不用滚回页脚找按钮。
 * 左侧提示脏状态（琥珀点）与 ⌘S 快捷键，右侧取消 + 提交（shadcn Button）。
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
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/85 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur-md',
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
        <span className="text-[12px] text-muted-foreground">{hint ?? '⌘/Ctrl + S 保存'}</span>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          取消
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? '保存中…' : mode === 'create' ? createLabel : editLabel}
        </Button>
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
    <Input
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
    />
  );
}

/** 上下架徽标（published 布尔口径的模块共用）。 */
export const publishedBadge = (published: boolean) =>
  published
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    : 'bg-amber-50 text-amber-700 ring-amber-200';

export function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <ShadcnBadge className={className}>{children}</ShadcnBadge>;
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
