import {
  MARKET_STATUS,
  MARKET_TYPES,
  marketStatusLabels,
  marketTypeLabels,
  type AdminMarketRow,
  type HomeBannerInput,
} from './resources';
import type { ResourceFieldConfig, ResourceFormValues } from '@/components/admin/crud/ResourceForm';
import { bodyFromHtml, isoOrNull } from './resource-mapping';

/**
 * 资源模块的字段配置与「schema 解析结果 ↔ 表行 ↔ 表单值」映射。
 * 与 resources.ts 的 zod schema 同源维护：改字段要同时改 schema 和这里的配置。
 *
 * 2026-11 后台瘦身：仅保留供需数据（market）与首页 Banner 的映射。
 */

/* ── 供需市场 ───────────────────────────────────────────────────────────── */

export const marketFields: ResourceFieldConfig[] = [
  { name: 'title', label: '标题', type: 'text', required: true, max: 120 },
  { name: 'slug', label: 'Slug（URL 标识）', type: 'text', required: true, max: 80 },
  {
    name: 'type',
    label: '类型',
    type: 'select',
    required: true,
    options: MARKET_TYPES.map((t) => ({ value: t, label: marketTypeLabels[t] })),
  },
  { name: 'category', label: '分类', type: 'text', required: true, max: 40, placeholder: '例：算力 / 场地 / 服务' },
  { name: 'summary', label: '摘要', type: 'textarea', required: true, max: 300, rows: 3 },
  { name: 'bodyHtml', label: '详情正文（富文本）', type: 'richtext', hint: '可选' },
  { name: 'org_name', label: '发布方', type: 'text', max: 80, placeholder: '可选' },
  { name: 'contact_hint', label: '联系提示', type: 'text', max: 200, placeholder: '例：站内信 / 邮箱（可选）' },
  { name: 'tags', label: '标签', type: 'tags' },
  {
    name: 'status',
    label: '撮合状态',
    type: 'select',
    options: MARKET_STATUS.map((s) => ({ value: s, label: marketStatusLabels[s] })),
  },
  { name: 'published_at', label: '发布时间', type: 'datetime', hint: '留空 = 保存时取当前时间' },
  { name: 'published', label: '发布（前台可见）', type: 'switch', full: true },
];

export function marketToRow(input: {
  slug: string;
  type: string;
  title: string;
  category: string;
  summary: string;
  bodyHtml: string;
  org_name: string;
  tags: string[];
  contact_hint: string;
  status: string;
  published_at: string;
  published: boolean;
}): Record<string, unknown> {
  return {
    slug: input.slug,
    type: input.type,
    title: input.title,
    category: input.category,
    summary: input.summary,
    body: bodyFromHtml(input.bodyHtml ?? ''),
    org_name: input.org_name || null,
    tags: input.tags,
    contact_hint: input.contact_hint || null,
    status: input.status,
    published_at: isoOrNull(input.published_at ?? ''),
    published: input.published,
  };
}

export function marketRowToValues(row: AdminMarketRow): ResourceFormValues {
  return {
    title: row.title,
    slug: row.slug,
    type: row.type,
    category: row.category,
    summary: row.summary,
    bodyHtml: row.body?.[0] ?? '',
    org_name: row.org_name ?? '',
    contact_hint: row.contact_hint ?? '',
    tags: row.tags ?? [],
    status: row.status,
    published_at: row.published_at ? toLocalInput(row.published_at) : '',
    published: row.published,
  };
}

/* ── 首页 Banner ─────────────────────────────────────────────────────────── */

export const homeBannerToRow = (input: HomeBannerInput): Record<string, unknown> => ({
  image_url: input.image_url,
  alt: input.alt,
  sort_order: input.sort_order,
  published: input.published,
});

/* ── 公共工具 ───────────────────────────────────────────────────────────── */

/** ISO → datetime-local 输入值（yyyy-MM-ddTHH:mm，本地时区） */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
