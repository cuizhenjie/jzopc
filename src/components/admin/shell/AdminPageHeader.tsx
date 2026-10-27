'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ShaderAccent from '@/components/shaders/ShaderAccent';
import { AdminIcon } from './AdminIcons';
import { findNavByKey, type NavKey } from './admin-nav';

/**
 * 当前页标题区（App Shell 拆分后由 AdminShell 调用）：
 * 子页（new/edit）返回链接 + shader 强调条 + 标题/描述 + 操作区 + Supabase 未连接提示。
 * 返回链接只在 pathname ≠ 模块首页时出现 —— 列表页不需要「返回自己」。
 */
export default function AdminPageHeader({
  navKey,
  title,
  desc,
  actions,
  dbConfigured,
}: {
  navKey: NavKey;
  title: string;
  desc?: string;
  actions?: React.ReactNode;
  dbConfigured?: boolean;
}) {
  const pathname = usePathname();
  const item = findNavByKey(navKey);
  const showBack = item !== null && pathname !== item.href;

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {showBack && item && (
          <Link
            href={item.href}
            className="mb-2.5 inline-flex items-center gap-1 text-[12.5px] text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-brand-navy)]"
          >
            <AdminIcon name="chevronLeft" className="h-3.5 w-3.5" />
            返回{item.label}
          </Link>
        )}
        <ShaderAccent variant="brand" className="mb-3 max-w-[200px]" />
        <h1 className="text-[22px] font-semibold text-[var(--color-brand-navy)]">{title}</h1>
        {desc && <p className="mt-1.5 text-[13px] text-[var(--color-ink-2)]">{desc}</p>}
      </div>
      <div className="flex items-center gap-3">
        {dbConfigured === false && (
          <span className="rounded-full bg-amber-50 px-3.5 py-1.5 text-[12px] font-medium text-amber-700 ring-1 ring-amber-200">
            未连接 Supabase · 数据不可用
          </span>
        )}
        {actions}
      </div>
    </div>
  );
}
