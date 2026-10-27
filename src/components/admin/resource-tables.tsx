'use client';

import ResourceTable from '@/components/admin/crud/ResourceTable';
import { Badge, fmtDate } from '@/components/admin/crud/ui';
import {
  marketStatusLabels,
  marketTypeLabels,
  mediaKindLabels,
  type AdminAgentRow,
  type AdminCourseRow,
  type AdminEmpowerRow,
  type AdminMarketRow,
  type AdminMediaRow,
  type AdminPartnerRow,
} from '@/lib/admin/resources';
import { agentCategoryOptions } from '@/lib/admin/resource-configs';

/**
 * 各资源模块的列表表格封装（'use client'）。
 *
 * ResourceTable 的列定义（columns.cell）是函数，**不能**从服务端页面直接传
 * （Next 的 RSC 边界不允许跨端传函数）——所以每个模块在这里定义自己的列，
 * 服务端页面只传可序列化的 rows 数据。
 */

export function AgentsTable({ rows }: { rows: AdminAgentRow[] }) {
  return (
    <ResourceTable
      rows={rows}
      apiBase="/api/admin/agents"
      createHref="/admin/agents/new"
      editHref={(r) => `/admin/agents/${r.id}/edit`}
      nameOf={(r) => r.name}
      emptyTitle="暂无智能体"
      emptyCta="收录第一个智能体"
      columns={[
        {
          head: '名称',
          cell: (r) => (
            <div className="max-w-[300px]">
              <p className="flex items-center gap-2 truncate font-medium text-[var(--color-ink)]">
                {r.featured && (
                  <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
                    精选
                  </span>
                )}
                {r.name}
              </p>
            </div>
          ),
        },
        {
          head: '分类',
          cell: (r) => agentCategoryOptions.find((o) => o.value === r.category)?.label ?? r.category,
        },
        { head: '简介', cell: (r) => <span className="line-clamp-2 max-w-[280px] text-[var(--color-ink-2)]">{r.summary}</span> },
        { head: '排序', cell: (r) => r.sort_order, className: 'w-14 text-center text-[var(--color-ink-3)]' },
      ]}
    />
  );
}

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

export function CoursesTable({ rows }: { rows: AdminCourseRow[] }) {
  return (
    <ResourceTable
      rows={rows}
      apiBase="/api/admin/courses"
      createHref="/admin/courses/new"
      editHref={(r) => `/admin/courses/${r.id}/edit`}
      nameOf={(r) => r.title}
      emptyTitle="暂无课程"
      emptyCta="上架第一门课"
      columns={[
        {
          head: '标题',
          cell: (r) => (
            <div className="max-w-[300px]">
              <p className="truncate font-medium text-[var(--color-ink)]">{r.title}</p>
            </div>
          ),
        },
        { head: '方向', cell: (r) => r.track },
        { head: '讲师', cell: (r) => r.mentor ?? '—' },
        { head: '摘要', cell: (r) => <span className="line-clamp-2 max-w-[260px] text-[var(--color-ink-2)]">{r.summary}</span> },
        { head: '排序', cell: (r) => r.sort_order, className: 'w-14 text-center text-[var(--color-ink-3)]' },
      ]}
    />
  );
}

export function PartnersTable({ rows }: { rows: AdminPartnerRow[] }) {
  return (
    <ResourceTable
      rows={rows}
      apiBase="/api/admin/partners"
      createHref="/admin/partners/new"
      editHref={(r) => `/admin/partners/${r.id}/edit`}
      viewHref={(r) => (r.published && r.website ? r.website : undefined)}
      nameOf={(r) => r.name}
      emptyTitle="暂无合作伙伴"
      emptyCta="添加第一家"
      columns={[
        {
          head: '企业',
          cell: (r) => (
            <div className="flex items-center gap-3">
              {r.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element -- 外链 Logo，尺寸小且来源不定，用原生 img
                <img src={r.logo_url} alt={r.name} className="h-8 w-8 rounded-lg object-contain" />
              )}
              <span className="font-medium text-[var(--color-ink)]">{r.name}</span>
            </div>
          ),
        },
        { head: '分组', cell: (r) => r.group_name ?? '—' },
        {
          head: '官网',
          cell: (r) =>
            r.website ? (
              <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand-blue-deep)] hover:underline">
                {safeHostname(r.website)}
              </a>
            ) : (
              '—'
            ),
        },
        { head: '排序', cell: (r) => r.sort_order, className: 'w-14 text-center text-[var(--color-ink-3)]' },
      ]}
    />
  );
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function EmpowerTable({ rows }: { rows: AdminEmpowerRow[] }) {
  return (
    <ResourceTable
      rows={rows}
      apiBase="/api/admin/empower"
      rowKey={(r) => r.slug}
      createHref="/admin/empower/new"
      editHref={(r) => `/admin/empower/${r.slug}/edit`}
      viewHref={(r) => (r.published ? `/empower/${r.slug}` : undefined)}
      nameOf={(r) => r.title}
      emptyTitle="暂无赋能模块"
      emptyCta="创建第一个模块"
      columns={[
        {
          head: '模块',
          cell: (r) => (
            <div className="max-w-[320px]">
              <p className="truncate font-medium text-[var(--color-ink)]">
                <span className="mr-2 text-[11px] font-semibold text-[var(--color-ink-3)]">{r.index_no}</span>
                {r.title}
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--color-ink-3)]">/empower/{r.slug}</p>
            </div>
          ),
        },
        { head: '一句话介绍', cell: (r) => <span className="line-clamp-2 max-w-[300px] text-[var(--color-ink-2)]">{r.tagline}</span> },
        { head: '关联线索', cell: (r) => r.lead_type ?? '—' },
        { head: '排序', cell: (r) => r.sort_order, className: 'w-14 text-center text-[var(--color-ink-3)]' },
      ]}
    />
  );
}

function fmtSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function MediaTable({ rows }: { rows: AdminMediaRow[] }) {
  return (
    <ResourceTable
      rows={rows}
      apiBase="/api/admin/media"
      createHref="/admin/media/new"
      editHref={(r) => `/admin/media/${r.id}/edit`}
      viewHref={(r) => r.url}
      nameOf={(r) => r.path}
      emptyTitle="媒体库还是空的"
      emptyCta="登记第一个资源"
      columns={[
        {
          head: '预览',
          cell: (r) =>
            r.kind === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element -- 登记的外链/站内静态图，缩略预览
              <img src={r.url} alt={r.alt ?? r.path} className="h-10 w-16 rounded-lg bg-[var(--color-surface)] object-cover" />
            ) : (
              <span className="grid h-10 w-16 place-items-center rounded-lg bg-[var(--color-surface)] text-[11px] text-[var(--color-ink-3)]">
                {mediaKindLabels[r.kind] ?? r.kind}
              </span>
            ),
        },
        {
          head: '路径 / URL',
          cell: (r) => (
            <div className="max-w-[320px]">
              <p className="truncate font-mono text-[12px] text-[var(--color-ink)]">{r.path}</p>
              <p className="truncate text-[11px] text-[var(--color-ink-3)]">{r.url}</p>
            </div>
          ),
        },
        {
          head: '类型',
          cell: (r) => (
            <Badge className="bg-[var(--color-surface)] text-[var(--color-ink-2)] ring-[var(--color-line)]">
              {mediaKindLabels[r.kind] ?? r.kind}
            </Badge>
          ),
        },
        { head: '大小', cell: (r) => fmtSize(r.size_bytes) },
        { head: '登记时间', cell: (r) => fmtDate(r.created_at), className: 'text-[var(--color-ink-3)]' },
      ]}
    />
  );
}
