/** 复刻站区块运行时化层（2026-10-28 起：DB 唯一事实源，无烘焙兜底）。
 *
 * 演进：2026-10-26 版本是「DB 优先、烘焙兜底」；2026-10-28 起烘焙兜底移除，
 * 快照内容已由 scripts/seed-baked-blocks.mjs 灌入数据库——空库/查询异常
 * 一律渲染**空区块**，不再用烘焙内容顶替（后台删空 = 前台真空，彻底联动）。
 *
 * 页面外壳（导航/版式/CSS）仍是复刻产物，这里只做区块内容的确定性替换：
 *
 *   - 首页 hero 统计数字墙 ← site_stats（后台「统计数字」模块；保存已 revalidatePath('/')）
 *   - /center 课程方向卡   ← courses（后台课程模块；保存已 revalidatePath('/center')）
 *   - 首页 / 供需 / 工作三页伙伴墙 ← partners（后台合作伙伴模块；保存已 revalidate 三页）
 *   - /agent 分类 chips 与分区 ← agents；/market 供需卡 ← market_items
 *
 * 空区块语义：DB 无行/未配库/查询异常 → 对应区块容器替换为空（含 chips/状态行的
 * /agent 除外——它重建为「全部」chip + 共 0 个智能体）。结构找不到（生成产物
 * 结构变更）→ 该区块原样保留（外壳完整性保护，非数据兜底）。
 *
 * 本模块服务端专用（依赖 supabase admin 客户端）；页面级消费见
 * app/page.tsx、app/center|market|work|agent/page.tsx。
 */
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { agentCategories } from '@/lib/site/config';
import { escapeText, getReplicaPage, type ReplicaPageContent } from '@/lib/opc/content';

/* ── DB 行的最小输入面（只取展示要用的列）────────────────────────────────── */

export interface StatRow {
  value: number;
  suffix: string | null;
  label: string;
}

export interface CourseRow {
  title: string;
  summary: string | null;
  track: string | null;
  cover_url: string | null;
}

export interface PartnerRow {
  name: string;
  logo_url: string | null;
}

/** /agent 智能体卡与 /market 供需卡的最小输入面 */
export interface AgentRow {
  name: string;
  category: string;
  summary: string | null;
  external_url: string | null;
  icon_url: string | null;
}

export interface MarketItemRow {
  type: string;
  title: string;
  summary: string | null;
  org_name: string | null;
  tags: string[] | null;
  published_at: string | null;
}

/** site_stats 没有 published 列（全量展示），按 sort_order 排序；未配库/异常 → 空数组（区块置空）。 */
export async function loadSiteStats(): Promise<StatRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('site_stats')
      .select('value,suffix,label')
      .order('sort_order', { ascending: true });
    if (error) {
      console.error(`[blocks-runtime:site_stats] 查询失败，区块置空：${error.message}`);
      return [];
    }
    return (data ?? []) as StatRow[];
  } catch (e) {
    console.error('[blocks-runtime:site_stats] 查询异常，区块置空', e);
    return [];
  }
}

export async function loadCourses(): Promise<CourseRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('courses')
      .select('title,summary,track,cover_url')
      .eq('published', true)
      .order('sort_order', { ascending: true });
    if (error) {
      console.error(`[blocks-runtime:courses] 查询失败，区块置空：${error.message}`);
      return [];
    }
    return (data ?? []) as CourseRow[];
  } catch (e) {
    console.error('[blocks-runtime:courses] 查询异常，区块置空', e);
    return [];
  }
}

export async function loadPartners(): Promise<PartnerRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('partners')
      .select('name,logo_url')
      .eq('published', true)
      .order('sort_order', { ascending: true });
    if (error) {
      console.error(`[blocks-runtime:partners] 查询失败，区块置空：${error.message}`);
      return [];
    }
    return (data ?? []) as PartnerRow[];
  } catch (e) {
    console.error('[blocks-runtime:partners] 查询异常，区块置空', e);
    return [];
  }
}

/* ── 图片地址安全：后台录入的 URL 只允许 https 外链或本站根相对路径 ───────── */

function isSafeImage(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.startsWith('/')) return !value.startsWith('//') && !/[\u0000-\u001f\\]/.test(value);
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/* ── 确定性区块替换：括号配平，不做贪婪正则截断 ──────────────────────────── */

/** 在 html 中定位 openPattern 命中的开标签，按 div/ul 计数找到配平的闭标签，
 *  用 buildInner() 的返回替换区块内部（开闭标签本身保留原样，含其上的属性/样式）。 */
export function replaceBalancedBlock(
  html: string,
  openPattern: RegExp,
  tokens: readonly [open: string, close: string],
  buildInner: (originalInner: string) => string,
): string {
  const found = html.match(openPattern);
  if (!found || found.index === undefined) return html;
  const openTag = found[0];
  const openTagEnd = found.index + openTag.length;
  const openToken = tokens[0];
  const closeToken = tokens[1];
  let depth = 1;
  let cursor = openTagEnd;
  while (depth > 0) {
    const nextOpenAt = html.indexOf(openToken, cursor);
    const nextCloseAt = html.indexOf(closeToken, cursor);
    if (nextCloseAt < 0) return html; // 结构不完整：宁可不动，不可截断
    if (nextOpenAt >= 0 && nextOpenAt < nextCloseAt) {
      depth += 1;
      cursor = nextOpenAt + openToken.length;
    } else {
      depth -= 1;
      if (depth === 0) {
        const inner = html.slice(openTagEnd, nextCloseAt);
        const head = html.slice(0, openTagEnd);
        const tail = html.slice(nextCloseAt);
        return head + buildInner(inner) + tail;
      }
      cursor = nextCloseAt + closeToken.length;
    }
  }
  return html;
}

/* ── 首页统计数字墙 ───────────────────────────────────────────────────────── */

const HOME_STATS_OPEN = /<div[^>]*class="hero-stats-row[^"]*"[^>]*>/;

function formatStatValue(row: StatRow): string {
  const raw = row.suffix?.trim() ?? '';
  // '+'% 等符号型后缀紧贴数字（500+）；文字型后缀（家 / ㎡）补一个空格
  const suffix = raw.startsWith('+') ? raw : (raw ? ` ${raw}` : '');
  return `${row.value}${suffix}`;
}

/** 烘焙卡自带 data-v-* 作用域属性，沿用首页 hero 的作用域（af8bee70），保持参考 CSS 命中。 */
function statItemHtml(row: StatRow): string {
  return (
    `<div data-v-af8bee70="" class="hero-stat">`
    + `<span data-v-af8bee70="" class="hero-stat-num">${escapeText(formatStatValue(row))}</span>`
    + `<span data-v-af8bee70="" class="hero-stat-lbl">${escapeText(row.label)}</span>`
    + `</div>`
  );
}

/** 空数组 → 统计墙置空（容器保留，DB 是唯一事实源）。 */
export function applyHomeStats(html: string, rows: readonly StatRow[]): string {
  return replaceBalancedBlock(html, HOME_STATS_OPEN, ['<div', '</div>'], () =>
    rows.map(statItemHtml).join(''),
  );
}

/* ── /center 课程方向卡 ───────────────────────────────────────────────────── */

const COURSE_GRID_OPEN = /<div class="opc-academy-course-grid">/;

/** 烘焙卡的 (图片, 方向名) 对：track 命中时沿用其课程配图，配不上的回落第一张。 */
function bakedCourseImages(inner: string): Array<{ src: string; track: string }> {
  const imgs = [...inner.matchAll(/<img src="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  const tracks = [...inner.matchAll(/<h3>([^<]*)<\/h3>/g)].map((m) => m[1]);
  return imgs.map((src, i) => ({ src, track: tracks[i] ?? '' }));
}

function courseCardHtml(row: CourseRow, fallbackImages: Array<{ src: string; track: string }>): string {
  const track = row.track?.trim() ?? '';
  const safeCover = isSafeImage(row.cover_url) ? row.cover_url : null;
  const img =
    safeCover
    ?? fallbackImages.find((f) => f.track && f.track === track)?.src
    ?? fallbackImages[0]?.src
    ?? '';
  return (
    `<figure class="opc-academy-course-card">`
    + `<div class="opc-academy-course-media">`
    + (img ? `<img src="${escapeText(img)}" width="960" height="720" alt="${escapeText(row.title)}" loading="lazy" decoding="async" fetchpriority="auto">` : '')
    + `</div>`
    + `<figcaption>`
    + (track ? `<span class="opc-academy-course-tag">${escapeText(track)}</span>` : '')
    + `<h3>${escapeText(row.title)}</h3>`
    + `<p>${escapeText(row.summary ?? '')}</p>`
    + `</figcaption>`
    + `</figure>`
  );
}

/** 空数组 → 课程网格置空。cover 缺失时沿用同 track 的烘焙配图（配图属外壳素材，非数据兜底）。 */
export function applyCourseGrid(html: string, rows: readonly CourseRow[]): string {
  return replaceBalancedBlock(html, COURSE_GRID_OPEN, ['<div', '</div>'], (inner) =>
    rows.map((row) => courseCardHtml(row, bakedCourseImages(inner))).join(''),
  );
}

/* ── 伙伴墙（首页 / 供需 / 工作三页共用同一函数）────────────────────────── */

const PARTNER_GRID_OPEN = /<ul class="opc-visual-partner-grid"[^>]*>/;

/** 卡片结构完全沿用烘焙卡（img.opc-visual-partner-logo）；logo 不合法的行跳过，
 *  不做文字卡占位——设计层没有对应样式，宁缺毋滥。空数组 → 伙伴墙置空。 */
export function applyPartnerGrid(html: string, rows: readonly PartnerRow[]): string {
  const usable = rows.filter((row) => isSafeImage(row.logo_url) && row.name.trim().length > 0);
  return replaceBalancedBlock(html, PARTNER_GRID_OPEN, ['<ul', '</ul>'], () =>
    usable
      .map(
        (row) =>
          `<li class="opc-visual-partner-card">`
          + `<img src="${escapeText(row.logo_url as string)}" alt="${escapeText(row.name)}" loading="lazy" decoding="async" fetchpriority="auto" class="opc-visual-partner-logo">`
          + `</li>`,
      )
      .join(''),
  );
}

export async function loadAgents(): Promise<AgentRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('agents')
      .select('name,category,summary,external_url,icon_url')
      .eq('published', true)
      .order('sort_order', { ascending: true });
    if (error) {
      console.error(`[blocks-runtime:agents] 查询失败，区块置空：${error.message}`);
      return [];
    }
    return (data ?? []) as AgentRow[];
  } catch (e) {
    console.error('[blocks-runtime:agents] 查询异常，区块置空', e);
    return [];
  }
}

export async function loadMarketItems(): Promise<MarketItemRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('market_items')
      .select('type,title,summary,org_name,tags,published_at')
      .eq('published', true)
      .order('published_at', { ascending: false });
    if (error) {
      console.error(`[blocks-runtime:market_items] 查询失败，区块置空：${error.message}`);
      return [];
    }
    return (data ?? []) as MarketItemRow[];
  } catch (e) {
    console.error('[blocks-runtime:market_items] 查询异常，区块置空', e);
    return [];
  }
}

/* ── 外链安全：智能体外链仅允许 https（target=_blank 的跳转目标）────────── */

function isSafeExternalUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/* ── /agent 智能体目录 ────────────────────────────────────────────────────── */

const AGENT_FILTER_SCROLL_OPEN = /<div[^>]*class="filter-scroll"[^>]*>/;
const AGENT_RESULTS_OPEN = /<div[^>]*data-opc-agent-results[^>]*>/;
/** 侧栏 chip 模板（照抄烘焙「全部」chip 的结构，含 chip-dot 装饰） */
const AGENT_CHIP_SVG = '<svg data-v-199d00a7="" class="chip-dot" viewbox="0 0 8 8" aria-hidden="true"><circle data-v-199d00a7="" cx="4" cy="4" r="3" fill="currentColor"></circle></svg>';

function agentChipHtml(label: string, active: boolean): string {
  const cls = active ? 'filter-chip hero-anim-fade-up active' : 'filter-chip hero-anim-fade-up';
  return (
    `<button data-v-199d00a7="" class="${cls}" data-opc-action="filter-tools" data-opc-value="${escapeText(label)}" aria-pressed="${active}" type="button">`
    + `${AGENT_CHIP_SVG} ${escapeText(label)} </button>`
  );
}

/** 卡片右下角箭头装饰沿用烘焙卡的 svg（从原 HTML 提取，提不到就不渲染该 span） */
function extractTcLinkSpan(html: string): string {
  const found = html.match(/<span[^>]*class="tc-link">[\s\S]*?<\/span>/);
  return found ? found[0] : '';
}

function hostOf(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return '';
  }
}

function agentCardHtml(row: AgentRow, label: string, tcLink: string): string {
  const categories = escapeText(JSON.stringify([label]));
  const icon = isSafeImage(row.icon_url)
    ? `<img class="tc-icon" src="${escapeText(row.icon_url)}" alt="" loading="lazy" decoding="async">`
    : '';
  return (
    `<a data-v-199d00a7="" class="tool-card revealed" href="${escapeText(row.external_url as string)}" target="_blank" rel="noopener noreferrer" style="transition-delay:0ms" data-opc-categories="${categories}" data-opc-search-text="${escapeText(row.summary ?? '')}">`
    + `<span data-v-199d00a7="" class="tc-glare" aria-hidden="true"></span>`
    + `<span data-v-199d00a7="" class="tc-border-glow" aria-hidden="true"></span>`
    + `<div data-v-199d00a7="" class="tc-body">${icon}`
    + `<span data-v-199d00a7="" class="tc-tag">${escapeText(label)}</span>`
    + `<h3 data-v-199d00a7="" class="tc-title">${escapeText(row.name)}</h3>`
    + `<p data-v-199d00a7="" class="tc-desc">${escapeText(row.summary ?? '')}</p>`
    + `<div data-v-199d00a7="" class="tc-footer">`
    + `<code data-v-199d00a7="" class="tc-domain">${escapeText(hostOf(row.external_url as string))}</code>`
    + tcLink
    + `</div></div></a>`
  );
}

/** DB 智能体接管 /agent：侧栏 chips + 结果区（状态行 + 按分类分区）整体重建。
 *  分类 label 取 site/config 的 agentCategories（与后台表单同源）；外链不合法的行跳过。
 *  空库/全部不可用 → 仍重建：仅「全部」chip + 「共 0 个智能体」状态行（无烘焙兜底）。 */
export function applyAgentTools(html: string, rows: readonly AgentRow[]): string {
  const usable = rows.filter((row) => isSafeExternalUrl(row.external_url) && row.name.trim().length > 0);

  const labelOf = new Map<string, string>(agentCategories.map((c) => [c.slug as string, c.name as string]));
  const groups = new Map<string, AgentRow[]>();
  for (const row of usable) {
    const label = labelOf.get(row.category) ?? row.category;
    const list = groups.get(label) ?? [];
    list.push(row);
    groups.set(label, list);
  }

  const tcLink = extractTcLinkSpan(html);
  let out = replaceBalancedBlock(html, AGENT_FILTER_SCROLL_OPEN, ['<div', '</div>'], () =>
    ['全部', ...groups.keys()].map((label, i) => agentChipHtml(label, i === 0)).join(''),
  );

  const sections = [...groups.entries()]
    .map(([label, list], i) => {
      const cards = list.map((row) => agentCardHtml(row, label, tcLink)).join('');
      return (
        `<section data-v-199d00a7="" class="section category-sec" data-opc-agent-group="${escapeText(label)}" aria-labelledby="agent-category-${i + 1}">`
        + `<div data-v-199d00a7="" class="container">`
        + `<div data-v-199d00a7="" class="sec-head revealed">`
        + `<span data-v-199d00a7="" class="sec-eyebrow">${escapeText(label)}</span>`
        + `<h2 data-v-199d00a7="" id="agent-category-${i + 1}">${escapeText(label)}智能体</h2>`
        + `<p data-v-199d00a7="" class="sec-sub">${list.length} 个智能体 · ${escapeText(label)}类智能体，按后台配置排序</p>`
        + `</div><div class="tool-grid">${cards}</div></div></section>`
      );
    })
    .join('');
  const status = (
    `<p class="opc-agent-status" data-opc-agent-status="" role="status" aria-live="polite" aria-atomic="true">`
    + `共 ${usable.length} 个智能体</p>`
  );
  out = replaceBalancedBlock(out, AGENT_RESULTS_OPEN, ['<div', '</div>'], () => status + sections);
  return out;
}

/* ── /market 供需卡（供给 / 需求两区各自替换）────────────────────────────── */

const SUPPLY_GRID_OPEN = /<div[^>]*class="supply-grid"[^>]*>/;
const DEMAND_GRID_OPEN = /<div[^>]*class="demand-grid"[^>]*>/;

/** 烘焙日期形如 2026/6/25（无前导零）；DB 是 date 或 timestamptz——
 *  统一按北京时间取日历日（避免 0-8 点录入的 UTC 前一天），解析失败留空。 */
function marketDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const picked = new Map(parts.map((p) => [p.type, p.value]));
  const year = Number(picked.get('year'));
  const month = Number(picked.get('month'));
  const day = Number(picked.get('day'));
  if (!year || !month || !day) return '';
  return `${year}/${month}/${day}`;
}

function tagsOf(row: MarketItemRow): string[] {
  return (row.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 4);
}

function supplyCardHtml(row: MarketItemRow): string {
  const tags = tagsOf(row);
  const initial = (row.org_name ?? row.title).trim().charAt(0);
  const tagsHtml = tags.map((t) => `<span data-v-18addbe5="" class="sc-tag">${escapeText(t)}</span>`).join('');
  return (
    `<article data-v-18addbe5="" class="supply-card" style="transition-delay:0ms" data-opc-category="${escapeText(tags.join(','))}">`
    + `<div data-v-18addbe5="" class="sc-body">`
    + (tags.length ? `<div data-v-18addbe5="" class="sc-tags">${tagsHtml}</div>` : '')
    + `<h3 data-v-18addbe5="" class="sc-title">${escapeText(row.title)}</h3>`
    + `<p data-v-18addbe5="" class="sc-desc">${escapeText(row.summary ?? '')}</p>`
    + `<div data-v-18addbe5="" class="sc-footer">`
    + `<div data-v-18addbe5="" class="sc-author">`
    + `<div data-v-18addbe5="" class="sc-avatar">${escapeText(initial)}</div>`
    + `<div data-v-18addbe5="" class="sc-author-info">`
    + `<span data-v-18addbe5="" class="sc-author-name">${escapeText(row.org_name ?? '社区成员')}</span>`
    + `<span data-v-18addbe5="" class="sc-date">${escapeText(marketDate(row.published_at))}</span>`
    + `</div></div>`
    + `<a data-v-18addbe5="" href="/opcapply?formType=partner" class="sc-contact">联系合作</a>`
    + `</div></div></article>`
  );
}

function demandCardHtml(row: MarketItemRow): string {
  const tags = tagsOf(row);
  const tagsHtml = tags.map((t) => `<span data-v-18addbe5="" class="dc-tag">${escapeText(t)}</span>`).join('');
  return (
    `<article data-v-18addbe5="" class="demand-card" style="transition-delay:0ms" data-opc-category="${escapeText(tags.join(','))}">`
    + `<div data-v-18addbe5="" class="dc-body">`
    + `<div data-v-18addbe5="" class="dc-header">`
    + `<div data-v-18addbe5="" class="dc-user">`
    + `<div data-v-18addbe5="" class="dc-avatar">${escapeText((row.org_name ?? row.title).trim().charAt(0))}</div>`
    + `<div data-v-18addbe5="" class="dc-user-info"><h4 data-v-18addbe5="">${escapeText(row.org_name ?? '社区成员')}</h4></div>`
    + `</div></div>`
    + `<h3 data-v-18addbe5="" class="dc-title">${escapeText(row.title)}</h3>`
    + `<p data-v-18addbe5="" class="dc-desc">${escapeText(row.summary ?? '')}</p>`
    + (tags.length ? `<div data-v-18addbe5="" class="dc-tags">${tagsHtml}</div>` : '')
    + `<div data-v-18addbe5="" class="dc-footer">`
    + `<span data-v-18addbe5="" class="dc-time">${escapeText(marketDate(row.published_at))}</span>`
    + `<a data-v-18addbe5="" href="/opcapply?formType=partner" class="dc-contact">联系合作</a>`
    + `</div></div></article>`
  );
}

/** 供需两区**各自整体替换**（空侧 → 置空，不再保留烘焙卡）；
 *  运营可以只录一边，另一侧显示为空。 */
export function applyMarketItems(html: string, rows: readonly MarketItemRow[]): string {
  const titled = rows.filter((row) => row.title.trim().length > 0);
  const supply = titled.filter((row) => row.type === 'supply');
  const demand = titled.filter((row) => row.type === 'demand');
  let out = replaceBalancedBlock(html, SUPPLY_GRID_OPEN, ['<div', '</div>'], () =>
    supply.map(supplyCardHtml).join(''),
  );
  out = replaceBalancedBlock(out, DEMAND_GRID_OPEN, ['<div', '</div>'], () =>
    demand.map(demandCardHtml).join(''),
  );
  return out;
}

export async function getRuntimeReplicaPage(pathname: string): Promise<ReplicaPageContent | null> {
  const base = getReplicaPage(pathname);
  if (!base) return null;

  let html = base.html;
  try {
    if (pathname === '/') {
      const [stats, partners] = await Promise.all([loadSiteStats(), loadPartners()]);
      html = applyHomeStats(html, stats);
      html = applyPartnerGrid(html, partners);
    } else if (pathname === '/center') {
      html = applyCourseGrid(html, await loadCourses());
    } else if (pathname === '/agent') {
      html = applyAgentTools(html, await loadAgents());
    } else if (pathname === '/market') {
      const [partners, marketItems] = await Promise.all([loadPartners(), loadMarketItems()]);
      html = applyPartnerGrid(html, partners);
      html = applyMarketItems(html, marketItems);
    } else if (pathname === '/work') {
      html = applyPartnerGrid(html, await loadPartners());
    } else {
      return base;
    }
  } catch (e) {
    // 外壳完整性保护（bug 级兜底，非数据兜底）：区块替换本身不应抛错，
    // 万一抛错也绝不 500 —— 保留替换到一半之前的进度并继续返回页面。
    console.error(`[blocks-runtime:${pathname}] 区块替换异常，保留已替换进度`, e);
  }
  return { ...base, html };
}
