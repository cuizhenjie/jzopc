/** 公开站区块运行时化层（2026-11-10 全站复刻对齐参考站）。
 *
 * 参考站页面是**静态快照**（scripts/opc-reference/ → generated/pages.json），
 * 但以下区块必须由后台动态维护，DB 是唯一事实源：
 *
 *   - 首页首屏背景轮播     ← home_banners（后台「首页 Banner」）
 *   - 首页 hero 统计数字墙 ← site_stats（后台「统计数字」模块）
 *   - 首页社区动态四卡     ← news_posts（最新 4 条）
 *   - 集智商学院课程体系   ← courses（后台课程模块）
 *   - 关于页生态伙伴墙     ← partners（后台合作伙伴模块）
 *   - /agent 智能体目录    ← agents（分类 chips + 结果网格）
 *   - /news 社区动态列表   ← news_posts（列表 + 详情）
 *
 * 定位方式：编译期给容器打了 `data-opc-block="<marker>"` 标记
 * （见 scripts/build-opc-reference.mjs 的 markDynamicBlocks），
 * 运行期按标记找到容器并**整体替换内部**；容器本身的标签与属性保留，
 * 标记找不到时保持原样（外壳完整性保护，不做数据兜底）。
 *
 * 空区块语义：DB 无行 / 未配库 / 查询异常 → 对应容器置空（后台删空 = 前台真空）。
 * 例外：首页首屏 banner。未配库或查询失败时保留烘焙图；查询成功（含 0 条可用图）才替换。
 *
 * 本模块服务端专用（依赖 supabase admin 客户端）。
 */
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { agentCategories } from '@/lib/site/config';
import { escapeText, getReplicaPage, type ReplicaPageContent } from '@/lib/opc/content';
import { replaceBlockInner, replaceElementInnerById } from '@/lib/opc/dom';

/* ── DB 行的最小输入面（只取展示要用的列）────────────────────────────────── */

export interface StatRow {
  value: number;
  suffix: string | null;
  label: string;
}

export interface BannerRow {
  image_url: string;
  alt: string;
}

export type HomeBannerLoad =
  | { status: 'unavailable' }
  | { status: 'ready'; rows: BannerRow[] };

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

export interface AgentRow {
  name: string;
  category: string;
  summary: string | null;
  external_url: string | null;
  icon_url: string | null;
}

/* ── DB 读取 ───────────────────────────────────────────────────────────── */

/** 首页首屏图。失败或未配库返回 unavailable，调用方必须保留烘焙图。 */
export async function loadHomeBanners(): Promise<HomeBannerLoad> {
  const sb = getSupabaseAdmin();
  if (!sb) return { status: 'unavailable' };
  try {
    const { data, error } = await sb
      .from('home_banners')
      .select('image_url,alt')
      .eq('published', true)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (error) {
      console.error(`[blocks-runtime:home_banners] 查询失败，保留烘焙首屏：${error.message}`);
      return { status: 'unavailable' };
    }
    return { status: 'ready', rows: (data ?? []) as BannerRow[] };
  } catch (e) {
    console.error('[blocks-runtime:home_banners] 查询异常，保留烘焙首屏', e);
    return { status: 'unavailable' };
  }
}

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

/** 首页四卡用的最新动态（DB 唯一事实源；未配库 / 异常 → 空数组，四卡区置空）。
 *
 * ⚠️ news_posts 用的是 `status`（draft/published/archived），**没有 `published` 布尔列**
 * —— 写错列名会静默查不到数据（PostgREST 对不存在的列直接报 42703）。 */
export async function loadHomeNews(): Promise<HomeNewsRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('news_posts')
      .select('slug,title,summary,category,published_at,cover_url')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(4);
    if (error) {
      console.error(`[blocks-runtime:home_news] 查询失败，区块置空：${error.message}`);
      return [];
    }
    return (data ?? []) as HomeNewsRow[];
  } catch (e) {
    console.error('[blocks-runtime:home_news] 查询异常，区块置空', e);
    return [];
  }
}

/* ── 图片与外链安全 ────────────────────────────────────────────────────── */

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

function isSafeExternalUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function hostOf(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return '';
  }
}

/* ── 首页 hero 统计数字墙 ───────────────────────────────────────────────── */

function statItemHtml(row: StatRow): string {
  const suffix = (row.suffix ?? '').trim();
  // '+' 之类符号型前缀单独着色（参考站 .hstat b i 的样式约定），单位留在数字后
  const symbol = suffix.match(/^[+]+/)?.[0] ?? '';
  const unit = suffix.slice(symbol.length);
  const valueHtml = symbol
    ? `${escapeText(String(row.value))}<i>${escapeText(symbol)}</i>${unit ? escapeText(unit) : ''}`
    : `${escapeText(String(row.value))}${unit ? escapeText(unit) : ''}`;
  return `<div class="hstat"><b>${valueHtml}</b><span>${escapeText(row.label)}</span></div>`;
}

export function applyHomeStats(html: string, rows: readonly StatRow[]): string {
  return replaceBlockInner(html, 'home-stats', 'div', () => rows.map(statItemHtml).join(''));
}

/* ── 首页首屏背景轮播 ───────────────────────────────────────────────────── */

function heroSlideHtml(row: BannerRow, first: boolean): string {
  const attrs = first
    ? 'class="hero__slide is-on" fetchpriority="high" decoding="async"'
    : 'class="hero__slide" loading="lazy" decoding="async"';
  return `<img ${attrs} src="${escapeText(row.image_url)}" alt="${escapeText(row.alt)}">`;
}

/**
 * 查询成功后替换首屏图。不安全的地址整张丢掉。
 * 开标签补 `data-hero-live`，让 CSS 停掉两张图的自动交叉淡入，只显示 `.is-on`。
 * 标记缺失时原样返回。
 */
export function applyHomeBanners(html: string, rows: readonly BannerRow[]): string {
  if (!/<div\b[^>]*\bdata-opc-block="home-banners"/i.test(html)) return html;
  const slides = rows.filter((row) => isSafeImage(row.image_url));
  const inner = slides.map((row, index) => heroSlideHtml(row, index === 0)).join('');
  const replaced = replaceBlockInner(html, 'home-banners', 'div', () => inner);
  return replaced.replace(
    /(<div\b[^>]*\bdata-opc-block="home-banners"[^>]*)(>)/i,
    (full, open: string, end: string) => (/\bdata-hero-live\b/.test(open) ? full : `${open} data-hero-live${end}`),
  );
}

/* ── 首页社区动态四卡 ───────────────────────────────────────────────────── */

export interface HomeNewsRow {
  slug: string;
  title: string;
  summary: string;
  category: string;
  published_at: string;
  cover_url?: string | null;
}

const HOME_NEWS_FALLBACK_COVER = '/opc/reference/img/news-wuzhen-opc.jpg';

function homeNewsCardHtml(row: HomeNewsRow): string {
  const cover = isSafeImage(row.cover_url) ? row.cover_url : HOME_NEWS_FALLBACK_COVER;
  const date = /^(\d{4})-(\d{2})-(\d{2})/.exec(row.published_at ?? '');
  const dateText = date ? `${date[1]}-${date[2]}-${date[3]}` : '';
  const href = `/newsdetail?id=${encodeURIComponent(row.slug)}`;
  return (
    `<article class="ncard rv vis" data-news-cat="${escapeText(row.category)}">`
    + `<a class="ncard__hit" href="${escapeText(href)}" aria-label="${escapeText(row.title)}"></a>`
    + `<div class="ncard__ph"><img src="${escapeText(cover)}" alt="${escapeText(row.title)}" loading="lazy" decoding="async"></div>`
    + `<div class="ncard__bd">`
    + `<h3>${escapeText(row.title)}</h3>`
    + `<div class="ncard__meta"><span class="ntag">${escapeText(row.category)}</span>`
    + `<span class="ncard__date">${escapeText(dateText)}</span></div>`
    + `<p>${escapeText(row.summary)}</p>`
    + `</div></article>`
  );
}

/** 首页四卡取最新 4 条已发布动态；DB 空 → 四卡区置空。 */
export function applyHomeNews(html: string, rows: readonly HomeNewsRow[]): string {
  return replaceBlockInner(html, 'home-news', 'div', () =>
    rows.slice(0, 4).map((row) => homeNewsCardHtml(row)).join(''),
  );
}

/* ── 集智商学院课程体系 ─────────────────────────────────────────────────── */

const COURSE_COVER_FALLBACK = '/opc/reference/img/course-aigc.jpg';

function courseCardHtml(row: CourseRow): string {
  const cover = isSafeImage(row.cover_url) ? row.cover_url : COURSE_COVER_FALLBACK;
  const track = (row.track ?? '').trim();
  return (
    `<a class="ac-crs__i rv vis" href="/academy#courses">`
    + `<div class="ac-crs__ph"><img src="${escapeText(cover)}" alt="${escapeText(row.title)}" loading="lazy" decoding="async"></div>`
    + `<div class="ac-crs__bd">`
    + `<h3>${escapeText(row.title)}</h3>`
    + `<p>${escapeText(row.summary ?? '')}</p>`
    + (track ? `<span class="tag">${escapeText(track)}</span>` : '')
    + `</div></a>`
  );
}

export function applyCourseGrid(html: string, rows: readonly CourseRow[]): string {
  return replaceBlockInner(html, 'course-grid', 'div', () => rows.map(courseCardHtml).join(''));
}

/* ── 生态伙伴墙 ─────────────────────────────────────────────────────────── */

function partnerCardHtml(row: PartnerRow): string {
  const logo = isSafeImage(row.logo_url) ? row.logo_url : '';
  const name = escapeText(row.name);
  return (
    `<li class="partner-wall__i">`
    + (logo
      ? `<img src="${escapeText(logo)}" alt="${name}" loading="lazy" decoding="async">`
      : `<span class="partner-wall__txt">${name}</span>`)
    + `</li>`
  );
}

export function applyPartnerGrid(html: string, rows: readonly PartnerRow[]): string {
  const usable = rows.filter((row) => row.name.trim().length > 0);
  return replaceBlockInner(html, 'partner-grid', 'ul', () => usable.map(partnerCardHtml).join(''));
}

/* ── /agent 智能体目录 ──────────────────────────────────────────────────── */

const AGENT_COLORS = ['#EAF3FD', '#EAF9F4', '#FDF1EA', '#F0EDFD', '#EAF6FD', '#FFF6E6'];

function initialsOf(name: string): string {
  const cleaned = name.replace(/[^一-龥A-Za-z0-9]/g, '');
  return (cleaned.slice(0, 1) || '?').toUpperCase();
}

const LINK_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
  + '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"></path>'
  + '<path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"></path></svg>';

function agentCardHtml(row: AgentRow, index: number): string {
  const name = escapeText(row.name);
  const url = escapeText(row.external_url as string);
  const bg = AGENT_COLORS[index % AGENT_COLORS.length];
  const icon = isSafeImage(row.icon_url)
    ? `<img class="acard__fav" src="${escapeText(row.icon_url)}" alt="" loading="lazy" decoding="async">`
    : `<span class="acard__fav" style="background:${bg}">${escapeText(initialsOf(row.name))}</span>`;
  return (
    `<a class="acard" href="${url}" target="_blank" rel="noopener noreferrer" data-opc-categories="${escapeText(row.category)}" data-opc-search="${escapeText(row.summary ?? '')}">`
    + `<div class="acard__top">${icon}<span class="acard__nm">${name}</span></div>`
    + `<p>${escapeText(row.summary ?? '')}</p>`
    + `<span class="acard__url">${LINK_ICON}${escapeText(hostOf(row.external_url as string))}</span>`
    + `</a>`
  );
}

/**
 * /agent 目录整体接管：分类 chips + 结果计数 + 网格。
 * 空库 / 全部外链不合法 → 仍重建：仅「全部」chip + 「共 0 个智能体」+ 空网格。
 */
export function applyAgentTools(html: string, rows: readonly AgentRow[]): string {
  const usable = rows.filter((row) => isSafeExternalUrl(row.external_url) && row.name.trim().length > 0);
  const labelOf = new Map<string, string>(
    agentCategories.map((c) => [c.slug as string, c.name as string]),
  );
  // 分组键用**分类 slug**（与卡片的 data-opc-categories 同源，筛选按 slug 比对），
  // chip 文案用中文名；库里出现未知 slug 时直接用 slug 原文兜底。
  const groups = new Map<string, { label: string; rows: AgentRow[] }>();
  for (const row of usable) {
    const slug = row.category;
    const label = labelOf.get(slug) ?? slug;
    const group = groups.get(slug) ?? { label, rows: [] };
    group.rows.push(row);
    groups.set(slug, group);
  }

  const chips = ['all', ...groups.keys()]
    .map((slug, index) => {
      const group = groups.get(slug);
      const count = group ? group.rows.length : usable.length;
      const active = index === 0 ? ' on' : '';
      const text = group ? group.label : '全部';
      return `<button class="chip${active}" type="button" data-cat="${escapeText(slug)}" aria-pressed="${index === 0}">${escapeText(text)} <span style="opacity:.7">${count}</span></button>`;
    })
    .join('');

  let out = replaceElementInnerById(html, 'agentChips', 'div', () => chips);
  out = replaceElementInnerById(out, 'agentCount', 'b', () => String(usable.length));
  out = replaceBlockInner(out, 'agent-grid', 'div', () =>
    usable.map((row, index) => agentCardHtml(row, index)).join(''),
  );
  return out;
}

/* ── 页面级运行时渲染 ───────────────────────────────────────────────────── */

export async function getRuntimeReplicaPage(pathname: string): Promise<ReplicaPageContent | null> {
  const base = getReplicaPage(pathname);
  if (!base) return null;

  let html = base.html;
  try {
    if (pathname === '/') {
      const [stats, news, banners] = await Promise.all([loadSiteStats(), loadHomeNews(), loadHomeBanners()]);
      html = applyHomeStats(html, stats);
      html = applyHomeNews(html, news);
      if (banners.status === 'ready') html = applyHomeBanners(html, banners.rows);
    } else if (pathname === '/about') {
      html = applyPartnerGrid(html, await loadPartners());
    } else if (pathname === '/academy') {
      html = applyCourseGrid(html, await loadCourses());
    } else if (pathname === '/agent') {
      html = applyAgentTools(html, await loadAgents());
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
