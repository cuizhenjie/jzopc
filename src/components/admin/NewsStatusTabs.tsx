import Link from 'next/link';

/**
 * 新闻/活动列表共用的状态筛选 Tab（GET 跳转，无 JS 也可用）。
 * basePath 例：/admin/news、/admin/activities。
 */

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '草稿' },
  { value: 'archived', label: '已下架' },
] as const;

export default function NewsStatusTabs({ basePath, status }: { basePath: string; status?: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="按状态筛选">
      {STATUS_TABS.map((tab) => {
        const active = (status ?? '') === tab.value;
        const href = tab.value ? `${basePath}?status=${tab.value}` : basePath;
        return (
          <Link
            key={tab.label}
            href={href}
            aria-current={active ? 'page' : undefined}
            role="tab"
            aria-selected={active}
            className={
              active
                ? 'rounded-full bg-[var(--color-brand-navy)] px-4 py-1.5 text-[13px] font-medium text-white'
                : 'rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)] transition-colors hover:text-[var(--color-brand-navy)]'
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
