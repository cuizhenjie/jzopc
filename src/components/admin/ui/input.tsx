'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * shadcn/ui Input（admin 版）：与既有 crud inputClass 同形
 * （rounded-xl / 14px / brand-blue 焦点边）。
 * 类字符串单独导出，供 TagInput 等需要拼类的场合与组件同源使用。
 */
export const inputClass =
  'flex h-10 w-full min-w-0 rounded-xl border border-input bg-card px-3.5 py-2.5 text-[14px] text-foreground outline-none transition-[color,box-shadow,border-color] placeholder:text-muted-foreground/70 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(inputClass, className)} {...props} />;
}

export { Input };
