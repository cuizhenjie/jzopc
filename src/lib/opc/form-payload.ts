/** 前台表单 → 后台线索（leads）的纯映射层。
 *
 * 2026-11-10 全站复刻后，参考站的两张表单（入驻意向表 / 供需发布表单）
 * 由 `src/components/opc/ReferenceInteractions.tsx` 直接接管 —— 它要往
 * `POST /api/leads` 提交线索（不再只写 localStorage）。
 *
 * 提交前要做三层**映射**：
 *   1. 表单选项文案 → 后台枚举（申请主体类型 → subjectType）；
 *   2. 表单选项文案 → 数值（团队人数区间 → teamSize）；
 *   3. 表单字段 → 线索字段（需要哪些赋能 → message 的一行）。
 *
 * 这些映射原本内联在组件的事件回调里 —— 组件既测不到、又容易和后台
 * schema 走偏（后台 `src/lib/lead/schema.ts` 的 subjectType 只有
 * 「个人 / 团队 / 企业」三个值，teamSize 是 1..999 的整数）。
 * 因此把**纯函数**抽到这里，组件只负责读 DOM、调函数、发请求。
 *
 * 本模块是纯函数（无 DOM、无 DB、无网络），可被测试直接覆盖。
 */

/** 线索提交端点（两个表单共用）。 */
export const LEAD_ENDPOINT = '/api/leads';

/** 入驻意向表提交给后台的 leadType。 */
export const APPLY_LEAD_TYPE = 'apply';
/** 供需发布表单提交给后台的 leadType。 */
export const MARKET_LEAD_TYPE = 'market';

/* ── 入驻意向表 ─────────────────────────────────────────────────────────── */

/**
 * 申请主体类型（参考站 select[name=type] 的选项文案）→ 后台 subjectType。
 *
 * 后台枚举只有「个人 / 团队 / 企业」三个值（src/lib/lead/schema.ts），
 * 参考站的 5 个选项必须收敛到其中之一：
 *   一人公司（OPC）→ 个人 · 创业团队 → 团队 · 已注册企业 → 企业
 *   高校 / 科研团队 → 团队 · 服务机构 → 企业
 */
export const APPLY_SUBJECT_TYPE_MAP: Readonly<Record<string, '个人' | '团队' | '企业'>> = {
  '一人公司（OPC）': '个人',
  '创业团队': '团队',
  '已注册企业': '企业',
  '高校 / 科研团队': '团队',
  '服务机构': '企业',
};

/** 未命中映射时的兜底（空选项 / 参考站改文案时不至于提交脏值）。 */
export const APPLY_SUBJECT_TYPE_FALLBACK = '团队';

/** 申请主体类型 → 后台 subjectType；未知取值回落到「团队」。 */
export function mapApplySubjectType(value: string | null | undefined): '个人' | '团队' | '企业' {
  return APPLY_SUBJECT_TYPE_MAP[(value ?? '').trim()] ?? APPLY_SUBJECT_TYPE_FALLBACK;
}

/**
 * 团队人数（参考站 select[name=size] 的选项文案）→ 后台 teamSize。
 *
 * 取的是区间**上限**（运营按上限估人天）；「30 人以上」没有上限，
 * 用 31 表示「超过 30」（后台约束 1..999）。
 */
export const APPLY_TEAM_SIZE_MAP: Readonly<Record<string, number>> = {
  '1 人（一人公司）': 1,
  '2–5 人': 5,
  '6–10 人': 10,
  '11–30 人': 30,
  '30 人以上': 31,
};

/** 未命中映射时的兜底人数（一人公司）。 */
export const APPLY_TEAM_SIZE_FALLBACK = 1;

/** 团队人数区间 → 后台 teamSize；未知取值回落到 1。 */
export function mapApplyTeamSize(value: string | null | undefined): number {
  return APPLY_TEAM_SIZE_MAP[(value ?? '').trim()] ?? APPLY_TEAM_SIZE_FALLBACK;
}

/** 入驻意向表的取值面（与参考站 form#joinForm 的字段同名）。 */
export interface ApplyFormValues {
  /** 申请主体类型（select[name=type] 的选中文案）。 */
  type: string;
  /** 团队人数（select[name=size] 的选中文案）。 */
  size: string;
  /** 需要哪些赋能（checkbox[name=need] 的选中值列表）。 */
  need: string[];
  /** 团队 / 公司名称（input[name=team]）。 */
  team: string;
  /** 联系人姓名（input[name=contact]）。 */
  contact: string;
  /** 手机号（input[name=tel]）。 */
  tel: string;
  /** 赛道（select[name=track] 的选中文案）。 */
  track: string;
  /** 一句话简介（textarea[name=intro]）。 */
  intro: string;
  /** 是否同意入驻须知（checkbox[name=agree]）。 */
  agree: boolean;
}

/** 线索载荷（与 src/lib/lead/schema.ts 的 leadSchema 对齐）。 */
export interface LeadPayload {
  leadType: string;
  name: string;
  contactType: 'phone';
  contact: string;
  orgName: string;
  subjectType: '个人' | '团队' | '企业';
  teamSize?: number;
  track?: string;
  message: string;
  agreeTerms?: boolean;
  sourcePage: string;
  sourceRef: string;
  /** 表单原始取值（仅供需发布表单携带），入库 leads.form_payload 供后台结构化展示。 */
  formPayload?: Record<string, unknown>;
}

/** 「需要哪些赋能」在 message 里的固定行首。 */
export const APPLY_NEEDS_LINE_PREFIX = '需要哪些赋能：';

/**
 * 入驻意向表 → 线索载荷。
 *
 * 映射约定（与后台 leads 表一一对应）：
 *   - 申请主体类型 → subjectType
 *   - 团队人数     → teamSize
 *   - 需要哪些赋能 → message 追加一行「需要哪些赋能：A、B」
 *   - 同意条款     → agreeTerms（申请入驻场景后台强制为 true）
 */
export function buildApplyLeadPayload(values: ApplyFormValues): LeadPayload {
  const needs = (values.need ?? []).map((item) => item.trim()).filter(Boolean);
  return {
    leadType: APPLY_LEAD_TYPE,
    name: values.contact.trim(),
    contactType: 'phone',
    contact: values.tel.trim(),
    orgName: values.team.trim(),
    subjectType: mapApplySubjectType(values.type),
    teamSize: mapApplyTeamSize(values.size),
    track: values.track.trim(),
    message: [values.intro.trim(), needs.length ? `${APPLY_NEEDS_LINE_PREFIX}${needs.join('、')}` : '']
      .filter(Boolean)
      .join('\n'),
    agreeTerms: values.agree === true,
    sourcePage: '/apply',
    sourceRef: 'join-form',
  };
}

/* ── 供需发布表单 ───────────────────────────────────────────────────────── */

/** 供需表单的两种形态。 */
export type MarketFormKind = 'need' | 'give';

/** 供需发布表单的取值面（与参考站 form#sdNeed / form#sdGive 的字段同名）。 */
export interface MarketFormValues {
  /** 机构名（input[name=org]）。 */
  org: string;
  /** 一句话说明（input[name=oneline]）。 */
  oneline: string;
  /** 联系人（input[name=contact]）。 */
  contact: string;
  /** 联系方式（input[name=tel]）。 */
  tel: string;
  /** 需求类型（checkbox[name=needtype]）。 */
  needTypes: string[];
  /** 需求详情（textarea[name=detail]）。 */
  detail: string;
  /** 预算（select[name=budget]）。 */
  budget: string;
  /** 时间（select[name=when]）。 */
  when: string;
  /** 供给类型（checkbox[name=givetype]）。 */
  giveTypes: string[];
  /** 供给产品（textarea[name=product]）。 */
  product: string;
  /** 合作边界（textarea[name=boundary]，可空）。 */
  boundary: string;
  /** 合作方式（checkbox[name=giveway]）。 */
  giveWays: string[];
  /** 价格（select[name=price]）。 */
  price: string;
  /** 公开范围（select[name=scope]）。 */
  scope: string;
}

/**
 * 供需发布 → 可复制的发布文案。
 *
 * 需求 / 供给两段的结构不同（参考站的发布文案也是两段），
 * 「合作边界」为空时整行省略（不留空行）。
 */
export function buildMarketCardText(kind: MarketFormKind, values: MarketFormValues): string {
  const lines: string[] = [];
  lines.push(`${kind === 'need' ? '【需求】' : '【供给】'}${values.oneline.trim()}`);
  lines.push(`名称：${values.org.trim()}`);
  if (kind === 'need') {
    lines.push(`类型：${values.needTypes.join(' / ')}`);
    lines.push(`要什么：${values.detail.trim()}`);
    lines.push(`预算 / 方式：${values.budget.trim()}`);
    lines.push(`时间：${values.when.trim()}`);
  } else {
    lines.push(`能提供：${values.giveTypes.join(' / ')}`);
    lines.push(`产品与适合谁：${values.product.trim()}`);
    if (values.boundary.trim()) lines.push(`合作边界：${values.boundary.trim()}`);
    lines.push(`合作方式：${values.giveWays.join(' / ')}｜${values.price.trim()}`);
    lines.push(`可响应：${values.when.trim()}`);
  }
  lines.push(`公开范围：${values.scope.trim()}`);
  lines.push(`联系：${values.contact.trim()} ${values.tel.trim()}`);
  return lines.join('\n');
}

/**
 * 供需发布 → 线索载荷。
 *
 * 供需发布不进 leads 的富字段，只把「发布文案」整体作为 message；
 * sourceRef 用 market:need / market:give 区分两栏。
 * 表单原始取值随 formPayload 入库（leads.form_payload），
 * 供 /admin/market 结构化展示——不从 message 文案反解。
 */
export function buildMarketLeadPayload(kind: MarketFormKind, values: MarketFormValues): LeadPayload {
  return {
    leadType: MARKET_LEAD_TYPE,
    name: values.contact.trim() || '社区成员',
    contactType: 'phone',
    contact: values.tel.trim(),
    orgName: values.org.trim(),
    subjectType: '团队',
    message: buildMarketCardText(kind, values),
    sourcePage: '/market',
    sourceRef: kind === 'need' ? 'market:need' : 'market:give',
    formPayload: { kind, ...values },
  };
}

/** 从 leads.form_payload 解析出的供需表单取值（parseMarketFormPayload 的返回类型）。 */
export type MarketFormPayload = {
  kind: MarketFormKind;
  values: MarketFormValues;
};

const strOf = (v: unknown): string => (typeof v === 'string' ? v : '');
const strListOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

/**
 * leads.form_payload（jsonb）→ 供需表单取值面。
 *
 * 写库前已过了 zod（src/lib/lead/schema.ts 的 formPayload），理论上形态可靠；
 * 这里仍按「宽容读取」处理：非对象 / kind 非法 → null，
 * 调用方回退展示 message 原文（2026-11-10 前的旧数据没有 payload 列）。
 */
export function parseMarketFormPayload(raw: unknown): MarketFormPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.kind !== 'need' && o.kind !== 'give') return null;
  return {
    kind: o.kind,
    values: {
      org: strOf(o.org),
      oneline: strOf(o.oneline),
      contact: strOf(o.contact),
      tel: strOf(o.tel),
      needTypes: strListOf(o.needTypes),
      detail: strOf(o.detail),
      budget: strOf(o.budget),
      when: strOf(o.when),
      giveTypes: strListOf(o.giveTypes),
      product: strOf(o.product),
      boundary: strOf(o.boundary),
      giveWays: strListOf(o.giveWays),
      price: strOf(o.price),
      scope: strOf(o.scope),
    },
  };
}

/* ── 智能体目录：分类筛选 + 关键词搜索 ─────────────────────────────────── */

/**
 * 解析卡片上的分类属性（data-opc-categories）。
 *
 * 两种形态都支持：JSON 数组（'["a","b"]'）与逗号分隔（'a,b'）。
 * 与 chips 的 data-cat 同源 —— 都是后台分类 slug。
 */
export function parseAgentCategories(raw: string | null | undefined): string[] {
  const value = raw ?? '';
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) return parsed.map((item) => String(item));
  } catch {
    /* 非 JSON 形态：按逗号切分兜底 */
  }
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

/** 智能体卡片的可筛选信息面。 */
export interface AgentQueryInput {
  /** 卡片可见文本（名称 + 摘要 + 域名）。 */
  text?: string | null;
  /** 卡片搜索属性（data-opc-search）。 */
  search?: string | null;
  /** 卡片分类属性（data-opc-categories）。 */
  categories?: string | null;
}

/**
 * 智能体卡片是否命中当前的「分类 + 关键词」组合。
 *
 * - 分类为 'all' 时不限分类；
 * - 关键词为空时不限文本；
 * - 两者都是**同值比对**（slug 对 slug），不做任何别名映射。
 */
export function matchesAgentQuery(
  input: AgentQueryInput,
  current: string,
  keyword: string,
): boolean {
  const category = (current || 'all').trim();
  if (category !== 'all') {
    const categories = parseAgentCategories(input.categories);
    if (!categories.includes(category)) return false;
  }
  const needle = (keyword ?? '').trim().toLowerCase();
  if (needle) {
    const haystack = `${input.text ?? ''} ${input.search ?? ''}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

/** 按当前筛选条件过滤智能体卡片。 */
export function filterAgents<T extends AgentQueryInput>(
  cards: readonly T[],
  current: string,
  keyword: string,
): T[] {
  return cards.filter((card) => matchesAgentQuery(card, current, keyword));
}
