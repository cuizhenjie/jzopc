import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/admin/ui/button';

/**
 * 列表页页头操作区的链接按钮模板（shadcn Button asChild）。
 *
 * 页面模板约定（opendesign CMS 版式）：
 * - 主操作（新建）用 default 变体（品牌藏蓝）；
 * - 次操作（导出等）用 outline 变体；
 * - 页内不再手写按钮样式字符串，保证 12+ 列表页视觉同源。
 */
export function ActionLink({
  href,
  variant = 'default',
  external = false,
  children,
}: {
  href: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
  external?: boolean;
  children: ReactNode;
}) {
  if (external) {
    return (
      <Button asChild variant={variant}>
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      </Button>
    );
  }
  return (
    <Button asChild variant={variant}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
