import { z } from 'zod';

/**
 * 新闻动态的后台编辑契约（对齐 supabase/migrations/0001_init.sql 的 news_posts 表）。
 *
 * - `body` 在库里是 jsonb 段落数组。富文本改造后（2026-10-25），编辑器输出
 *   的 HTML **整体作为单段**存入 body；公开渲染两侧（OPC 复刻页
 *   news-runtime.renderArticleSegment 与 /news/[slug] 的 rte-body 渲染）
 *   都按「段内含 HTML 标签 → sanitize 后渲染，否则按纯文本段落排版」的双模式处理，
 *   所以**存量纯文本段落与新富文本段可以共存**，无需数据迁移。
 * - 安全：编辑器只允许 https? 链接/图片；公开侧渲染统一过 sanitize-html
 *   （ARTICLE_SANITIZE_OPTIONS），存储不等于可信。
 * - `slug` 全局唯一（DB 唯一约束），撞车时 API 返回 23505 → 友好提示。
 * - `published_at` 用 datetime-local 的值（yyyy-MM-ddTHH:mm），入库存 timestamptz。
 */

export const NEWS_CATEGORIES = ['沙龙', '活动', '资讯', '社区'] as const;
export const NEWS_STATUSES = ['draft', 'published', 'archived'] as const;

export const newsStatusLabels: Record<(typeof NEWS_STATUSES)[number], string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已下架',
};

const slugRe = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

/** 富文本上限：tiptap 全量 HTML（含样式属性）按 20 万字符封顶，防御异常粘贴。 */
const BODY_HTML_MAX = 200_000;

export const newsInputSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(120, '标题过长（≤120 字）'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'slug 至少 2 个字符')
    .max(80, 'slug 过长（≤80 字符）')
    .regex(slugRe, 'slug 只能用小写字母、数字和中划线，且以字母/数字开头结尾'),
  summary: z.string().trim().min(1, '摘要不能为空').max(200, '摘要过长（≤200 字）'),
  category: z.enum(NEWS_CATEGORIES),
  author: z.string().trim().max(40, '作者名过长（≤40 字）').optional().default(''),
  status: z.enum(NEWS_STATUSES),
  cover_url: z
    .string()
    .trim()
    .url('封面链接格式不正确')
    .max(500, '封面链接过长')
    .optional()
    .or(z.literal(''))
    .transform((v) => v || null),
  /** 富文本正文（HTML）。纯空白内容（如空 <p></p>）会被拒绝。 */
  bodyHtml: z
    .string()
    .trim()
    .min(1, '正文不能为空')
    .max(BODY_HTML_MAX, '正文过长')
    .refine((v) => stripHtmlToText(v).length > 0, '正文内容不能为空'),
  /** 发布时间：日期或日期时间；空串/缺省 = 用当前时间（toNewsRow 兜底）。 */
  published_at: z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/, '发布时间格式不正确'),
    ])
    .optional()
    .default(''),
});

export type NewsInput = z.infer<typeof newsInputSchema>;

/** 去标签取可见文本（校验「正文非空白」用；不做安全清洗——那是渲染侧 sanitize 的职责）。 */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, '')
    .trim();
}

/** slug 为空时的兜底生成：news-<base36 时间戳>，保证唯一性交给 DB 约束。 */
export function autoSlug(): string {
  return `news-${Date.now().toString(36)}`;
}

/**
 * 存量段落（纯文本或 HTML 段）→ 编辑器初始 HTML。
 * 纯文本段包 <p>，HTML 段原样保留——与公开渲染的双模式判定一致。
 */
export function segmentsToHtml(segments: string[]): string {
  return segments
    .map((s) => (/<\/?[a-z][^>]*>/i.test(s) ? s : `<p>${s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`))
    .join('');
}

/** newsInputSchema 解析结果 → news_posts 表行（insert/update 共用）。 */
export function toNewsRow(input: NewsInput): Record<string, unknown> {
  const publishedAt = input.published_at
    ? new Date(input.published_at.length === 10 ? `${input.published_at}T00:00:00` : input.published_at).toISOString()
    : new Date().toISOString();
  return {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    // 富文本 HTML 整体作为单段入库；公开渲染侧按双模式 sanitize
    body: [input.bodyHtml],
    category: input.category,
    author: input.author || null,
    status: input.status,
    cover_url: input.cover_url,
    published_at: publishedAt,
  };
}

/** zod issues → 表单字段错误映射（同 api/leads 的返回形状）。 */
export function zodFieldErrors(issues: { path: (string | number | symbol)[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}
