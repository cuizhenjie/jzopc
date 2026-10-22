import { getSupabaseAdmin } from '@/lib/supabase/server';

/**
 * 管理后台的数据访问层（服务端专用，全部走 service_role）。
 *
 * 与 src/lib/queries（公开站）的差异：
 * - 线索：不过滤状态，支持筛选/搜索/分页；
 * - 新闻：读**全部状态**（含草稿/已下架），公开站只读 published。
 */

export type AdminLeadRow = {
  id: number;
  lead_type: string;
  name: string;
  contact_type: 'phone' | 'email';
  contact: string;
  org_name: string | null;
  role: string | null;
  subject_type: string | null;
  team_size: number | null;
  track: string | null;
  message: string | null;
  source_page: string;
  source_ref: string | null;
  utm: Record<string, unknown> | null;
  status: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminNewsRow = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  body: string[];
  cover_url: string | null;
  category: string;
  author: string | null;
  status: string;
  published_at: string;
  created_at: string;
  updated_at: string;
};

export const LEAD_STATUSES = ['new', 'contacting', 'converted', 'invalid'] as const;
export const leadStatusLabels: Record<string, string> = {
  new: '新建',
  contacting: '跟进中',
  converted: '已转化',
  invalid: '无效',
};

export const LEAD_TYPES = [
  'apply',
  'compute',
  'enterprise',
  'traffic',
  'capital',
  'space',
  'course',
  'market',
  'subscribe',
  'contact',
] as const;
export const leadTypeLabels: Record<string, string> = {
  apply: '申请入驻',
  compute: '算力',
  enterprise: '企服',
  traffic: '流量',
  capital: '资本',
  space: '空间',
  course: '课程',
  market: '供需',
  subscribe: '订阅',
  contact: '咨询',
};

export const LEAD_PAGE_SIZE = 50;

export type LeadFilters = {
  status?: string;
  type?: string;
  q?: string;
  page?: number;
};

export type LeadListResult = {
  rows: AdminLeadRow[];
  total: number;
  page: number;
  pageCount: number;
};

function normalizeBody(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

/** 线索列表：状态/类型筛选 + 关键词（姓名/联系方式/公司）+ 分页。 */
export async function listLeads(filters: LeadFilters): Promise<LeadListResult> {
  const sb = getSupabaseAdmin();
  if (!sb) return { rows: [], total: 0, page: 1, pageCount: 0 };

  let query = sb.from('leads').select('*', { count: 'exact' });

  if (filters.status && leadStatusLabels[filters.status]) {
    query = query.eq('status', filters.status);
  }
  if (filters.type && leadTypeLabels[filters.type]) {
    query = query.eq('lead_type', filters.type);
  }
  if (filters.q) {
    const kw = `%${filters.q.replace(/[%_]/g, (c) => `\\${c}`)}%`;
    query = query.or(`name.ilike.${kw},contact.ilike.${kw},org_name.ilike.${kw}`);
  }

  const page = Math.max(1, filters.page ?? 1);
  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range((page - 1) * LEAD_PAGE_SIZE, page * LEAD_PAGE_SIZE - 1);

  if (error) {
    console.error(`[admin:leads] 查询失败：${error.message}`);
    return { rows: [], total: 0, page: 1, pageCount: 0 };
  }

  const total = count ?? 0;
  return {
    rows: (data ?? []) as unknown as AdminLeadRow[],
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / LEAD_PAGE_SIZE)),
  };
}

/** 概览用：各状态线索计数 + 近 N 天新增。 */
export async function leadStats(): Promise<{ byStatus: Record<string, number>; recent7d: number; total: number }> {
  const sb = getSupabaseAdmin();
  const empty = { byStatus: {}, recent7d: 0, total: 0 };
  if (!sb) return empty;

  const { data, error } = await sb.from('leads').select('status, created_at');
  if (error || !data) {
    console.error(`[admin:lead-stats] 查询失败：${error?.message}`);
    return empty;
  }

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const byStatus: Record<string, number> = {};
  let recent7d = 0;
  for (const row of data as { status: string; created_at: string }[]) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    if (new Date(row.created_at).getTime() >= weekAgo) recent7d += 1;
  }
  return { byStatus, recent7d, total: data.length };
}

/** 后台新闻列表：全部状态。status 传空 = 全部。 */
export async function listNews(status?: string): Promise<AdminNewsRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  let query = sb.from('news_posts').select('*');
  if (status && ['draft', 'published', 'archived'].includes(status)) {
    query = query.eq('status', status);
  }
  const { data, error } = await query.order('published_at', { ascending: false }).limit(200);
  if (error) {
    console.error(`[admin:news] 查询失败：${error.message}`);
    return [];
  }
  return (data ?? []).map((row) => ({ ...(row as object), body: normalizeBody((row as { body?: unknown }).body) })) as unknown as AdminNewsRow[];
}

export async function getNewsById(id: number): Promise<AdminNewsRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb.from('news_posts').select('*').eq('id', id).maybeSingle();
  if (error) {
    console.error(`[admin:news] 按 id 查询失败：${error.message}`);
    return null;
  }
  if (!data) return null;
  return { ...(data as object), body: normalizeBody((data as { body?: unknown }).body) } as unknown as AdminNewsRow;
}

/** 概览用：新闻各状态计数。 */
export async function newsStats(): Promise<Record<string, number>> {
  const sb = getSupabaseAdmin();
  if (!sb) return {};
  const { data, error } = await sb.from('news_posts').select('status');
  if (error || !data) return {};
  const byStatus: Record<string, number> = {};
  for (const row of data as { status: string }[]) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  }
  return byStatus;
}

/* ── CSV 导出（RFC 4180 转义 + BOM，Excel 打开中文不乱码）────────────────── */

export const LEAD_CSV_COLUMNS: { key: keyof AdminLeadRow; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'lead_type', label: '类型' },
  { key: 'name', label: '姓名' },
  { key: 'contact_type', label: '联系方式类型' },
  { key: 'contact', label: '联系方式' },
  { key: 'org_name', label: '公司/团队' },
  { key: 'role', label: '职务' },
  { key: 'subject_type', label: '意向方向' },
  { key: 'team_size', label: '团队规模' },
  { key: 'track', label: '课程方向' },
  { key: 'message', label: '留言' },
  { key: 'source_page', label: '来源页' },
  { key: 'source_ref', label: '来源引用' },
  { key: 'utm', label: 'UTM' },
  { key: 'status', label: '状态' },
  { key: 'note', label: '备注' },
  { key: 'created_at', label: '创建时间' },
  { key: 'updated_at', label: '更新时间' },
];

/** 单元格转义：含逗号/引号/换行时整体加引号，内部引号翻倍。导出供单测使用。 */
export function csvEscape(value: unknown): string {
  const s =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function leadsToCsv(rows: AdminLeadRow[]): string {
  const header = LEAD_CSV_COLUMNS.map((c) => csvEscape(c.label)).join(',');
  const lines = rows.map((row) =>
    LEAD_CSV_COLUMNS.map((c) => csvEscape(row[c.key])).join(','),
  );
  return `\uFEFF${[header, ...lines].join('\r\n')}`;
}
