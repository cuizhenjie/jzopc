import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * 空态占位（shadcn 官方 Empty 的精简 admin 版）：
 * 标题 + 描述 + 可选操作（通常是「新建第一条」的 Button asChild）。
 */
function Empty({
  className,
  icon,
  title,
  description,
  action,
}: {
  className?: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="empty"
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-8 py-16 text-center',
        className,
      )}
    >
      {icon && <div className="text-muted-foreground/60 [&_svg]:size-10">{icon}</div>}
      <p className="text-[15px] font-medium text-[var(--color-brand-navy)]">{title}</p>
      {description && <p className="mx-auto max-w-md text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export { Empty };
