import { z } from 'zod';
import { agentCategories } from '@/lib/site/config';

/**
 * 管理后台「资源模块」的统一契约：8 个规划中模块
 * （智能体工具 / 供需市场 / 课程管理 / 社区专区（复用 news）/ 合作伙伴 /
 *   统计数字 / 八大赋能 / 页面文案 / 媒体库）的 zod schema 与行类型。
 *
 * 设计：全部走「服务端 zod 校验 + service_role 直写 + RLS 零策略」的既有模式
 * （与 news/leads 一致）；表单 UI 由 crud/ResourceForm 按字段配置渲染。
 */

const slugRe = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

export const AGENT_CATEGORY_SLUGS = agentCategories.map((c) => c.slug) as string[];

const optionalUrl = z
  .string()
  .trim()
  .url('链接格式不正确（https://…）')
  .max(500, '链接过长')
  .optional()
  .or(z.literal(''))
  .transform((v) => v || null);

const tagsField = z.array(z.string().trim().min(1).max(40)).max(12, '最多 12 个标签').default([]);

/** 表单 JSON 文本校验：空串 = 缺省放行；非空必须是合法 JSON（数组/对象两种形态）。 */
function jsonArrayRefine(message = '需为合法的 JSON 数组') {
  return z.literal('').or(z.string().trim()).transform((v) => v).refine((text) => {
    if (!text.trim()) return true;
    try {
      return Array.isArray(JSON.parse(text));
    } catch {
      return false;
    }
  }, message);
}

function jsonObjectRefine(message = '需为合法的 JSON 对象') {
  return z.literal('').or(z.string().trim()).refine((text) => {
    if (!text.trim()) return true;
    try {
      const v = JSON.parse(text);
      return v !== null && typeof v === 'object' && !Array.isArray(v);
    } catch {
      return false;
    }
  }, message);
}

/* ── 智能体工具 ─────────────────────────────────────────────────────────── */

export const agentInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(slugRe, 'slug 只能用小写字母、数字和中划线'),
  name: z.string().trim().min(1, '名称不能为空').max(80, '名称过长（≤80 字）'),
  category: z
    .string()
    .trim()
    .refine((v) => AGENT_CATEGORY_SLUGS.includes(v), '请选择已有分类'),
  summary: z.string().trim().min(1, '简介不能为空').max(300, '简介过长（≤300 字）'),
  description: z.string().trim().max(5000, '描述过长（≤5000 字）').optional().default(''),
  icon_url: optionalUrl,
  cover_url: optionalUrl,
  tags: tagsField,
  external_url: z
    .string()
    .trim()
    .url('工具地址格式不正确（https://…）')
    .max(500)
    .refine((v) => /^https?:\/\//i.test(v), '仅支持 http(s) 链接'),
  provider: z.string().trim().max(80).optional().default(''),
  featured: z.boolean().default(false),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.boolean().default(false),
});
export type AgentInput = z.infer<typeof agentInputSchema>;

export type AdminAgentRow = {
  id: number;
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string | null;
  icon_url: string | null;
  cover_url: string | null;
  tags: string[];
  external_url: string;
  provider: string | null;
  featured: boolean;
  sort_order: number;
  published: boolean;
};

/* ── 供需市场 ───────────────────────────────────────────────────────────── */

export const MARKET_TYPES = ['demand', 'supply'] as const;
export const MARKET_STATUS = ['open', 'matched', 'closed'] as const;
export const marketStatusLabels: Record<string, string> = {
  open: '进行中',
  matched: '已撮合',
  closed: '已关闭',
};
export const marketTypeLabels: Record<string, string> = { demand: '需求', supply: '供给' };

export const marketItemInputSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(slugRe, 'slug 只能用小写字母、数字和中划线'),
  type: z.enum(MARKET_TYPES),
  title: z.string().trim().min(1, '标题不能为空').max(120, '标题过长（≤120 字）'),
  category: z.string().trim().min(1, '分类不能为空').max(40, '分类过长（≤40 字）'),
  summary: z.string().trim().min(1, '摘要不能为空').max(300, '摘要过长（≤300 字）'),
  /** 富文本正文（HTML，单段入库）——与 news 的 body 同构 */
  bodyHtml: z.string().trim().max(200_000).optional().default(''),
  org_name: z.string().trim().max(80).optional().default(''),
  tags: tagsField,
  contact_hint: z.string().trim().max(200).optional().default(''),
  status: z.enum(MARKET_STATUS).default('open'),
  published_at: z
    .union([z.literal(''), z.string().trim().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/, '时间格式不正确')])
    .optional()
    .default(''),
  published: z.boolean().default(false),
});
export type MarketItemInput = z.infer<typeof marketItemInputSchema>;

export type AdminMarketRow = {
  id: number;
  slug: string;
  type: string;
  title: string;
  category: string;
  summary: string;
  body: string[];
  org_name: string | null;
  tags: string[];
  contact_hint: string | null;
  status: string;
  published_at: string | null;
  published: boolean;
};

/* ── 课程管理 ───────────────────────────────────────────────────────────── */

export const courseInputSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(slugRe, 'slug 只能用小写字母、数字和中划线'),
  track: z.string().trim().min(1, '方向不能为空').max(40, '方向过长（≤40 字）'),
  title: z.string().trim().min(1, '标题不能为空').max(120, '标题过长（≤120 字）'),
  summary: z.string().trim().min(1, '摘要不能为空').max(300, '摘要过长（≤300 字）'),
  bodyHtml: z.string().trim().max(200_000).optional().default(''),
  tags: tagsField,
  cover_url: optionalUrl,
  mentor: z.string().trim().max(60).optional().default(''),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.boolean().default(false),
});
export type CourseInput = z.infer<typeof courseInputSchema>;

export type AdminCourseRow = {
  id: number;
  slug: string;
  track: string;
  title: string;
  summary: string;
  body: string[];
  tags: string[];
  cover_url: string | null;
  mentor: string | null;
  sort_order: number;
  published: boolean;
};

/* ── 合作伙伴 ───────────────────────────────────────────────────────────── */

export const partnerInputSchema = z.object({
  name: z.string().trim().min(1, '名称不能为空').max(80, '名称过长（≤80 字）'),
  logo_url: optionalUrl,
  website: optionalUrl,
  group_name: z.string().trim().max(40).optional().default(''),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.boolean().default(false),
});
export type PartnerInput = z.infer<typeof partnerInputSchema>;

export type AdminPartnerRow = {
  id: number;
  name: string;
  logo_url: string | null;
  website: string | null;
  group_name: string | null;
  sort_order: number;
  published: boolean;
};

/* ── 统计数字（key 主键，无 published）──────────────────────────────────── */

export const siteStatInputSchema = z.object({
  key: z.string().trim().min(1, 'key 不能为空').max(40).regex(/^[a-z0-9_-]+$/, 'key 只能用小写字母、数字、中划线、下划线'),
  value: z.coerce.number().int().min(0).max(1_000_000_000),
  suffix: z.string().trim().max(8).default('+'),
  label: z.string().trim().min(1, '标签不能为空').max(40),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
});
export type SiteStatInput = z.infer<typeof siteStatInputSchema>;

export type AdminSiteStatRow = {
  key: string;
  value: number;
  suffix: string;
  label: string;
  sort_order: number;
};

/* ── 八大赋能（slug 主键）──────────────────────────────────────────────── */

export const empowerInputSchema = z.object({
  slug: z.string().trim().toLowerCase().regex(slugRe, 'slug 只能用小写字母、数字和中划线'),
  index_no: z.string().trim().min(1, '编号不能为空').max(8, '编号过长（如 01）'),
  title: z.string().trim().min(1, '标题不能为空').max(60, '标题过长（≤60 字）'),
  tagline: z.string().trim().min(1, '一句话介绍不能为空').max(200, '介绍过长（≤200 字）'),
  hero_desc: z.string().trim().max(600).optional().default(''),
  body_md: z.string().trim().max(20_000).optional().default(''),
  /** 复杂扩展字段以 JSON 编辑（values/items/highlights），留空 = 空数组 */
  values_json: jsonArrayRefine().optional().default(''),
  items_json: jsonArrayRefine().optional().default(''),
  highlights_json: jsonArrayRefine().optional().default(''),
  lead_type: z.string().trim().max(40).optional().default(''),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  published: z.boolean().default(false),
});
export type EmpowerInput = z.infer<typeof empowerInputSchema>;

export type AdminEmpowerRow = {
  slug: string;
  index_no: string;
  title: string;
  tagline: string;
  hero_desc: string | null;
  body_md: string | null;
  values: unknown[];
  items: unknown[];
  highlights: unknown[];
  lead_type: string | null;
  sort_order: number;
  published: boolean;
};

/* ── 页面文案 ───────────────────────────────────────────────────────────── */

export const siteContentInputSchema = z.object({
  section: z.string().trim().min(1, '区块不能为空').max(40, '区块过长（≤40 字）'),
  slug: z.string().trim().min(1, '标识不能为空').max(80, '标识过长（≤80 字）').regex(/^[a-z0-9_-]+$/, '标识只能用小写字母、数字、中划线、下划线'),
  title: z.string().trim().min(1, '标题不能为空').max(120, '标题过长（≤120 字）'),
  subtitle: z.string().trim().max(200).optional().default(''),
  body_md: z.string().trim().max(20_000).optional().default(''),
  meta_json: jsonObjectRefine().optional().default(''),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  published: z.boolean().default(false),
});
export type SiteContentInput = z.infer<typeof siteContentInputSchema>;

export type AdminSiteContentRow = {
  id: number;
  section: string;
  slug: string;
  title: string;
  subtitle: string | null;
  body_md: string | null;
  meta: Record<string, unknown> | null;
  sort_order: number;
  published: boolean;
};

/* ── 媒体库 ─────────────────────────────────────────────────────────────── */

export const MEDIA_KINDS = ['image', 'video', 'doc', 'other'] as const;
export const mediaKindLabels: Record<string, string> = {
  image: '图片',
  video: '视频',
  doc: '文档',
  other: '其他',
};

export const mediaInputSchema = z.object({
  path: z
    .string()
    .trim()
    .min(1, '路径不能为空')
    .max(300)
    .refine((v) => v.startsWith('/') && !v.startsWith('//'), '路径需以 / 开头（站内绝对路径）'),
  url: z
    .string()
    .trim()
    .url('URL 格式不正确')
    .max(600)
    .refine((v) => /^https?:\/\//i.test(v) || v.startsWith('/'), '仅支持 http(s) 或站内绝对路径'),
  kind: z.enum(MEDIA_KINDS),
  alt: z.string().trim().max(200).optional().default(''),
  size_bytes: z.coerce.number().int().min(0).max(10 ** 12).optional(),
});
export type MediaInput = z.infer<typeof mediaInputSchema>;

export type AdminMediaRow = {
  id: number;
  path: string;
  url: string;
  kind: string;
  alt: string | null;
  size_bytes: number | null;
  created_at: string;
};

/* ── 管理员账号 ─────────────────────────────────────────────────────────── */

export const adminAccountCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{3,32}$/, '用户名需 3-32 位小写字母/数字/中划线/下划线'),
  display_name: z.string().trim().min(1, '显示名不能为空').max(40, '显示名过长（≤40 字）'),
  password: z.string().min(8, '密码至少 8 位').max(128, '密码过长（≤128 位）'),
});

export const adminAccountPatchSchema = z.object({
  display_name: z.string().trim().min(1).max(40).optional(),
  password: z.string().min(8, '密码至少 8 位').max(128).optional(),
  is_active: z.boolean().optional(),
});

export type AdminAccountRow = {
  id: number;
  username: string;
  display_name: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};
