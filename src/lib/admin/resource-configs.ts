import {
  AGENT_CATEGORY_SLUGS,
  MARKET_STATUS,
  MARKET_TYPES,
  marketStatusLabels,
  marketTypeLabels,
  type AdminAgentRow,
  type AdminCourseRow,
  type AdminEmpowerRow,
  type AdminMarketRow,
  type AdminMediaRow,
  type AdminPartnerRow,
  type AdminSiteContentRow,
} from './resources';
import { agentCategories } from '@/lib/site/config';
import type { ResourceFieldConfig, ResourceFormValues } from '@/components/admin/crud/ResourceForm';
import { bodyFromHtml, isoOrNull, jsonArrayFromFormText, jsonObjectFromFormText } from './resource-mapping';

/**
 * 资源模块的字段配置与「schema 解析结果 ↔ 表行 ↔ 表单值」映射。
 * 与 resources.ts 的 zod schema 同源维护：改字段要同时改 schema 和这里的配置。
 */

export const agentCategoryOptions = agentCategories.map((c) => ({ value: c.slug, label: c.name }));

/* ── 智能体工具 ─────────────────────────────────────────────────────────── */

export const agentFields: ResourceFieldConfig[] = [
  { name: 'name', label: '名称', type: 'text', required: true, max: 80, placeholder: '例：AI 周报助手' },
  { name: 'slug', label: 'Slug（URL 标识）', type: 'text', required: true, max: 80, placeholder: 'ai-weekly' },
  {
    name: 'category',
    label: '分类',
    type: 'select',
    required: true,
    options: agentCategoryOptions,
    hint: `可选：${AGENT_CATEGORY_SLUGS.join(' / ')}`,
  },
  {
    name: 'summary',
    label: '简介',
    type: 'textarea',
    required: true,
    max: 300,
    rows: 3,
    placeholder: '一句话说清它能干什么（≤300 字）',
  },
  { name: 'external_url', label: '工具地址', type: 'text', required: true, placeholder: 'https://…' },
  { name: 'provider', label: '提供方', type: 'text', max: 80, placeholder: '可选' },
  { name: 'icon_url', label: '图标', type: 'image', placeholder: '上传或粘贴 https://…（可选）', uploadScene: 'media' },
  { name: 'cover_url', label: '封面图', type: 'image', placeholder: '上传或粘贴 https://…（可选）', uploadScene: 'covers' },
  { name: 'tags', label: '标签', type: 'tags', placeholder: '多个标签用逗号分隔' },
  { name: 'sort_order', label: '排序（小的在前）', type: 'number' },
  { name: 'featured', label: '首页精选', type: 'switch', full: true },
  { name: 'published', label: '发布', type: 'switch', full: true },
];

export function agentToRow(input: {
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string;
  icon_url: string | null;
  cover_url: string | null;
  tags: string[];
  external_url: string;
  provider: string;
  featured: boolean;
  sort_order: number;
  published: boolean;
}): Record<string, unknown> {
  return {
    slug: input.slug,
    name: input.name,
    category: input.category,
    summary: input.summary,
    description: input.description || null,
    icon_url: input.icon_url,
    cover_url: input.cover_url,
    tags: input.tags,
    external_url: input.external_url,
    provider: input.provider || null,
    featured: input.featured,
    sort_order: input.sort_order,
    published: input.published,
  };
}

export function agentRowToValues(row: AdminAgentRow): ResourceFormValues {
  return {
    name: row.name,
    slug: row.slug,
    category: row.category,
    summary: row.summary,
    description: row.description ?? '',
    external_url: row.external_url,
    provider: row.provider ?? '',
    icon_url: row.icon_url ?? '',
    cover_url: row.cover_url ?? '',
    tags: row.tags ?? [],
    sort_order: row.sort_order,
    featured: row.featured,
    published: row.published,
  };
}

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

/* ── 课程管理 ───────────────────────────────────────────────────────────── */

export const courseFields: ResourceFieldConfig[] = [
  { name: 'title', label: '标题', type: 'text', required: true, max: 120 },
  { name: 'slug', label: 'Slug（URL 标识）', type: 'text', required: true, max: 80 },
  { name: 'track', label: '课程方向', type: 'text', required: true, max: 40, placeholder: '例：AIGC 实战' },
  { name: 'mentor', label: '讲师', type: 'text', max: 60, placeholder: '可选' },
  { name: 'summary', label: '摘要', type: 'textarea', required: true, max: 300, rows: 3 },
  { name: 'bodyHtml', label: '课程详情（富文本）', type: 'richtext', hint: '可选' },
  { name: 'cover_url', label: '封面图', type: 'image', placeholder: '上传或粘贴 https://…（可选）', uploadScene: 'covers' },
  { name: 'tags', label: '标签', type: 'tags' },
  { name: 'sort_order', label: '排序（小的在前）', type: 'number' },
  { name: 'published', label: '发布（前台可见）', type: 'switch', full: true },
];

export function courseToRow(input: {
  slug: string;
  track: string;
  title: string;
  summary: string;
  bodyHtml: string;
  tags: string[];
  cover_url: string | null;
  mentor: string;
  sort_order: number;
  published: boolean;
}): Record<string, unknown> {
  return {
    slug: input.slug,
    track: input.track,
    title: input.title,
    summary: input.summary,
    body: bodyFromHtml(input.bodyHtml ?? ''),
    tags: input.tags,
    cover_url: input.cover_url,
    mentor: input.mentor || null,
    sort_order: input.sort_order,
    published: input.published,
  };
}

export function courseRowToValues(row: AdminCourseRow): ResourceFormValues {
  return {
    title: row.title,
    slug: row.slug,
    track: row.track,
    mentor: row.mentor ?? '',
    summary: row.summary,
    bodyHtml: row.body?.[0] ?? '',
    cover_url: row.cover_url ?? '',
    tags: row.tags ?? [],
    sort_order: row.sort_order,
    published: row.published,
  };
}

/* ── 合作伙伴 ───────────────────────────────────────────────────────────── */

export const partnerFields: ResourceFieldConfig[] = [
  { name: 'name', label: '企业名称', type: 'text', required: true, max: 80 },
  { name: 'group_name', label: '分组', type: 'text', max: 40, placeholder: '例：算力伙伴 / 生态伙伴（可选）' },
  { name: 'logo_url', label: 'Logo', type: 'image', placeholder: '上传或粘贴 https://…（可选）', uploadScene: 'media' },
  { name: 'website', label: '官网链接', type: 'text', placeholder: 'https://…（可选）' },
  { name: 'sort_order', label: '排序（小的在前）', type: 'number' },
  { name: 'published', label: '展示（前台可见）', type: 'switch', full: true },
];

export const partnerToRow = (input: {
  name: string;
  logo_url: string | null;
  website: string | null;
  group_name: string;
  sort_order: number;
  published: boolean;
}): Record<string, unknown> => ({
  name: input.name,
  logo_url: input.logo_url,
  website: input.website,
  group_name: input.group_name || null,
  sort_order: input.sort_order,
  published: input.published,
});

export function partnerRowToValues(row: AdminPartnerRow): ResourceFormValues {
  return {
    name: row.name,
    group_name: row.group_name ?? '',
    logo_url: row.logo_url ?? '',
    website: row.website ?? '',
    sort_order: row.sort_order,
    published: row.published,
  };
}

/* ── 八大赋能 ───────────────────────────────────────────────────────────── */

export const empowerFields: ResourceFieldConfig[] = [
  { name: 'index_no', label: '编号', type: 'text', required: true, max: 8, placeholder: '01' },
  { name: 'slug', label: 'Slug', type: 'text', required: true, max: 80, hint: '创建后不可改（前台路由 /empower/<slug>）' },
  { name: 'title', label: '标题', type: 'text', required: true, max: 60 },
  { name: 'tagline', label: '一句话介绍', type: 'textarea', required: true, max: 200, rows: 2 },
  { name: 'hero_desc', label: '模块页导语', type: 'textarea', max: 600, rows: 3, hint: '可选' },
  { name: 'body_md', label: '模块页正文（Markdown）', type: 'textarea', rows: 8, hint: '可选' },
  { name: 'values_json', label: '核心价值 values（JSON 数组）', type: 'json', rows: 4, hint: '可选' },
  { name: 'items_json', label: '服务项 items（JSON 数组）', type: 'json', rows: 4, hint: '可选' },
  { name: 'highlights_json', label: '亮点 highlights（JSON 数组）', type: 'json', rows: 4, hint: '可选' },
  { name: 'lead_type', label: '关联线索类型', type: 'text', max: 40, placeholder: '例：space / compute（可选）' },
  { name: 'sort_order', label: '排序（小的在前）', type: 'number' },
  { name: 'published', label: '发布', type: 'switch', full: true },
];

export function empowerToRow(input: {
  slug: string;
  index_no: string;
  title: string;
  tagline: string;
  hero_desc: string;
  body_md: string;
  values_json: string;
  items_json: string;
  highlights_json: string;
  lead_type: string;
  sort_order: number;
  published: boolean;
}): Record<string, unknown> {
  return {
    slug: input.slug,
    index_no: input.index_no,
    title: input.title,
    tagline: input.tagline,
    hero_desc: input.hero_desc || null,
    body_md: input.body_md || null,
    values: jsonArrayFromFormText(input.values_json ?? '') ?? [],
    items: jsonArrayFromFormText(input.items_json ?? '') ?? [],
    highlights: jsonArrayFromFormText(input.highlights_json ?? '') ?? [],
    lead_type: input.lead_type || null,
    sort_order: input.sort_order,
    published: input.published,
  };
}

export function empowerRowToValues(row: AdminEmpowerRow): ResourceFormValues {
  return {
    index_no: row.index_no,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    hero_desc: row.hero_desc ?? '',
    body_md: row.body_md ?? '',
    values_json: row.values?.length ? JSON.stringify(row.values, null, 2) : '',
    items_json: row.items?.length ? JSON.stringify(row.items, null, 2) : '',
    highlights_json: row.highlights?.length ? JSON.stringify(row.highlights, null, 2) : '',
    lead_type: row.lead_type ?? '',
    sort_order: row.sort_order,
    published: row.published,
  };
}

/* ── 页面文案 ───────────────────────────────────────────────────────────── */

export const siteContentFields: ResourceFieldConfig[] = [
  { name: 'section', label: '页面区块', type: 'text', required: true, max: 40, placeholder: '例：home-hero / about-intro' },
  { name: 'slug', label: '内容标识', type: 'text', required: true, max: 80, placeholder: '同区块内唯一' },
  { name: 'title', label: '标题', type: 'text', required: true, max: 120 },
  { name: 'subtitle', label: '副标题', type: 'text', max: 200, hint: '可选' },
  { name: 'body_md', label: '正文（Markdown）', type: 'textarea', rows: 8, hint: '可选' },
  { name: 'meta_json', label: '扩展字段 meta（JSON 对象）', type: 'json', rows: 4, hint: '可选' },
  { name: 'sort_order', label: '排序（小的在前）', type: 'number' },
  { name: 'published', label: '发布', type: 'switch', full: true },
];

export function siteContentToRow(input: {
  section: string;
  slug: string;
  title: string;
  subtitle: string;
  body_md: string;
  meta_json: string;
  sort_order: number;
  published: boolean;
}): Record<string, unknown> {
  return {
    section: input.section,
    slug: input.slug,
    title: input.title,
    subtitle: input.subtitle || null,
    body_md: input.body_md || null,
    meta: jsonObjectFromFormText(input.meta_json ?? '') ?? {},
    sort_order: input.sort_order,
    published: input.published,
  };
}

export function siteContentRowToValues(row: AdminSiteContentRow): ResourceFormValues {
  return {
    section: row.section,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? '',
    body_md: row.body_md ?? '',
    meta_json: row.meta && Object.keys(row.meta).length > 0 ? JSON.stringify(row.meta, null, 2) : '',
    sort_order: row.sort_order,
    published: row.published,
  };
}

/* ── 媒体库 ─────────────────────────────────────────────────────────────── */

export const mediaFields: ResourceFieldConfig[] = [
  { name: 'path', label: '站内路径', type: 'text', required: true, max: 300, placeholder: '/media/2026/logo.png' },
  { name: 'url', label: '访问 URL', type: 'text', required: true, max: 600, placeholder: 'https://… 或 /media/…' },
  {
    name: 'kind',
    label: '类型',
    type: 'select',
    required: true,
    options: [
      { value: 'image', label: '图片' },
      { value: 'video', label: '视频' },
      { value: 'doc', label: '文档' },
      { value: 'other', label: '其他' },
    ],
  },
  { name: 'alt', label: '替代文本', type: 'text', max: 200, placeholder: '图片描述（可选，利于无障碍与 SEO）' },
  { name: 'size_bytes', label: '大小（字节）', type: 'number', hint: '可选' },
];

export const mediaToRow = (input: {
  path: string;
  url: string;
  kind: string;
  alt: string;
  size_bytes?: number;
}): Record<string, unknown> => ({
  path: input.path,
  url: input.url,
  kind: input.kind,
  alt: input.alt || null,
  size_bytes: input.size_bytes ?? null,
});

export function mediaRowToValues(row: AdminMediaRow): ResourceFormValues {
  return {
    path: row.path,
    url: row.url,
    kind: row.kind,
    alt: row.alt ?? '',
    size_bytes: row.size_bytes ?? 0,
  };
}

/* ── 公共工具 ───────────────────────────────────────────────────────────── */

/** ISO → datetime-local 输入值（yyyy-MM-ddTHH:mm，本地时区） */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
