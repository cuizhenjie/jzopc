'use client';

import ResourceTable from '@/components/admin/crud/ResourceTable';
import { Badge } from '@/components/admin/crud/ui';
import {
  marketStatusLabels,
  marketTypeLabels,
  type AdminMarketRow,
} from '@/lib/admin/resources';

/**
 * 资源模块的列表表格封装（'use client'）。
 *
 * ResourceTable 的列定义（columns.cell）是函数，**不能**从服务端页面直接传
 * （Next 的 RSC 边界不允许跨端传函数）——所以每个模块在这里定义自己的列，
 * 服务端页面只传可序列化的 rows 数据。
 *
 * 2026-11 后台瘦身：仅保留供需数据模块；智能体 / 课程 / 合作伙伴 /
 * 八大赋能 / 媒体库表格随模块一并下线。
 */

const marketStatusTone: Record<string, string> = {
  open: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  matched: 'bg-blue-50 text-blue-700 ring-blue-200',
  closed: 'bg-gray-100 text-gray-500 ring-gray-200',
};

export function MarketTable({ rows }: { rows: AdminMarketRow[] }) {
  return (
    <ResourceTable
      rows={rows}
      apiBase="/api/admin/market"
      createHref="/admin/market/new"
      editHref={(r) => `/admin/market/${r.id}/edit`}
      nameOf={(r) => r.title}
      emptyTitle="暂无供需信息"
      emptyCta="发布第一条供需"
      publishLabels={{ on: '下架', off: '上架' }}
      confirmArchive="确定下架该供需信息？前台将立即不可见。"
      columns={[
        {
          head: '标题',
          cell: (r) => (
            <div className="max-w-[300px]">
              <p className="truncate font-medium text-[var(--color-ink)]">{r.title}</p>
            </div>
          ),
        },
        {
          head: '类型',
          cell: (r) => (
            <Badge
              className={
                r.type === 'demand' ? 'bg-orange-50 text-orange-700 ring-orange-200' : 'bg-violet-50 text-violet-700 ring-violet-200'
              }
            >
              {marketTypeLabels[r.type] ?? r.type}
            </Badge>
          ),
        },
        { head: '分类', cell: (r) => r.category },
        {
          head: '撮合状态',
          cell: (r) => (
            <Badge className={marketStatusTone[r.status] ?? marketStatusTone.closed}>
              {marketStatusLabels[r.status] ?? r.status}
            </Badge>
          ),
        },
        { head: '发布方', cell: (r) => r.org_name ?? '—' },
      ]}
    />
  );
}
