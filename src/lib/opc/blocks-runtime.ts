/** 复刻站区块运行时化层（2026-10-26「方式一」：DB 优先、烘焙兜底、后台保存即时失效）。
 *
 * 与 news-runtime（docs/14 契约）同一套语义，但目标区块没有构建期占位符——
 * 这里用「括号配平」在烘焙 HTML 上做确定性区块替换：
 *
 *   - 首页 hero 统计数字墙 ← site_stats（后台「统计数字」模块；保存已 revalidatePath('/')）
 *   - /center 课程方向卡   ← courses（后台课程模块；保存 revalidatePath('/center')）
 *   - 首页 / 供需 / 工作三页伙伴墙 ← partners（后台合作伙伴模块；保存 revalidate 三页）
 *
 * 回落规则（区块级）：未配置 Supabase / 查询异常 / 查询结果为空 → **保留烘焙 HTML**。
 * 统计墙与烘焙值本就同源（迁移 0005 种子），伙伴墙与课程卡在空库时维持现状口径。
 *
 * 结构找不到（生成产物结构变更）→ 原样返回，与 news-runtime 的占位符缺失兼容同款。
 *
 * 本模块服务端专用（依赖 supabase admin 客户端）；页面级消费见
 * app/page.tsx、app/center|market|work/page.tsx。
 */
import { getSupabaseAdmin } from '@/lib/supabase/server';
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

/** site_stats 没有 published 列（全量展示），按 sort_order 排序；失败 → null（区块回落烘焙）。 */
export async function loadSiteStats(): Promise<StatRow[] | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('site_stats')
      .select('value,suffix,label')
      .order('sort_order', { ascending: true });
    if (error) {
      console.error(`[blocks-runtime:site_stats] 查询失败，回落烘焙内容：${error.message}`);
      return null;
    }
    return (data ?? []) as StatRow[];
  } catch (e) {
    console.error('[blocks-runtime:site_stats] 查询异常，回落烘焙内容', e);
    return null;
  }
}

export async function loadCourses(): Promise<CourseRow[] | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('courses')
      .select('title,summary,track,cover_url')
      .eq('published', true)
      .order('sort_order', { ascending: true });
    if (error) {
      console.error(`[blocks-runtime:courses] 查询失败，回落烘焙内容：${error.message}`);
      return null;
    }
    return (data ?? []) as CourseRow[];
  } catch (e) {
    console.error('[blocks-runtime:courses] 查询异常，回落烘焙内容', e);
    return null;
  }
}

export async function loadPartners(): Promise<PartnerRow[] | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('partners')
      .select('name,logo_url')
      .eq('published', true)
      .order('sort_order', { ascending: true });
    if (error) {
      console.error(`[blocks-runtime:partners] 查询失败，回落烘焙内容：${error.message}`);
      return null;
    }
    return (data ?? []) as PartnerRow[];
  } catch (e) {
    console.error('[blocks-runtime:partners] 查询异常，回落烘焙内容', e);
    return null;
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

/** rows 为空数组时保留烘焙内容（调用方保证非空才进来，这里双保险）。 */
export function applyHomeStats(html: string, rows: readonly StatRow[]): string {
  if (rows.length === 0) return html;
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

export function applyCourseGrid(html: string, rows: readonly CourseRow[]): string {
  if (rows.length === 0) return html;
  return replaceBalancedBlock(html, COURSE_GRID_OPEN, ['<div', '</div>'], (inner) =>
    rows.map((row) => courseCardHtml(row, bakedCourseImages(inner))).join(''),
  );
}

/* ── 伙伴墙（首页 / 供需 / 工作三页共用同一函数）────────────────────────── */

const PARTNER_GRID_OPEN = /<ul class="opc-visual-partner-grid"[^>]*>/;

/** 卡片结构完全沿用烘焙卡（img.opc-visual-partner-logo）；logo 不合法的行跳过，
 *  不做文字卡占位——设计层没有对应样式，宁缺毋滥。 */
export function applyPartnerGrid(html: string, rows: readonly PartnerRow[]): string {
  const usable = rows.filter((row) => isSafeImage(row.logo_url) && row.name.trim().length > 0);
  if (usable.length === 0) return html;
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

/* ── 页面装配：按路径组合区块（未涉及的复刻页原样返回）─────────────────── */

export async function getRuntimeReplicaPage(pathname: string): Promise<ReplicaPageContent | null> {
  const base = getReplicaPage(pathname);
  if (!base) return null;

  let html = base.html;
  try {
    if (pathname === '/') {
      const [stats, partners] = await Promise.all([loadSiteStats(), loadPartners()]);
      if (stats && stats.length > 0) html = applyHomeStats(html, stats);
      if (partners && partners.length > 0) html = applyPartnerGrid(html, partners);
    } else if (pathname === '/center') {
      const courses = await loadCourses();
      if (courses && courses.length > 0) html = applyCourseGrid(html, courses);
    } else if (pathname === '/market' || pathname === '/work') {
      const partners = await loadPartners();
      if (partners && partners.length > 0) html = applyPartnerGrid(html, partners);
    } else {
      return base;
    }
  } catch (e) {
    // 兜底承诺：任何 DB 数据形状异常都不能让页面 500 —— 区块级回落到烘焙内容
    console.error(`[blocks-runtime:${pathname}] 区块替换异常，回落烘焙内容`, e);
    return base;
  }
  return { ...base, html };
}
