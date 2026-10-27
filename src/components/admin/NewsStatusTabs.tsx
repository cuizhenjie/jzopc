import Link from 'next/link';
import { Button } from '@/components/admin/ui/button';

/**
 * 新闻/活动列表共用的状态筛选 Tab（GET 跳转，无 JS 也可用）。
 * basePath 例：/admin/news、/admin/activities。
 *
 * 样式走 shadcn Button 变体（选中 default / 未选 outline）+ asChild 装扮 Link：
 * 语义仍是链接跳转，所以不用 Radix Tabs——那是 JS 受控组件，会破坏无 JS 回退。
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
          <Button
            key={tab.label}
            asChild
            variant={active ? 'default' : 'outline'}
            className="h-auto rounded-full px-4 py-1.5"
          >
            <Link href={href} aria-current={active ? 'page' : undefined} role="tab" aria-selected={active}>
              {tab.label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
