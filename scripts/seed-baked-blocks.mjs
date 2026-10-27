#!/usr/bin/env node
/**
 * 烘焙兜底数据 → 数据库 种子脚本（一次性，幂等）。
 *
 * 背景：docs/17「区块运行时化」原先的契约是「DB 优先、烘焙兜底」——
 * partners / agents / courses / market_items 四表为空时前台回落烘焙静态内容，
 * 造成「后台空数据、官网却显示」的不联动观感。本脚本把复刻快照
 * （src/lib/opc/generated/pages.json）里的烘焙内容解析成行灌进库里，
 * 配合运行时层移除兜底（空库 = 空区块），让 DB 成为唯一事实源。
 *
 * 数据映射（表结构见 supabase/migrations/0001_init.sql）：
 *   partners     ← 首页 ul.opc-visual-partner-grid 的 img（alt=name, src=logo_url），published=true
 *   agents       ← /agent 各 data-opc-agent-group 分区的 a.tool-card
 *                  （href=external_url, .tc-icon=icon_url, .tc-title=name, .tc-desc=summary,
 *                   分区 label → agent_categories.slug；烘焙 18 分区里不在既有 7 类的
 *                   先补插 agent_categories，保证 FK 可用）
 *   courses      ← /center .opc-academy-course-card（tag=track, h3=title, p=summary, img=cover_url）
 *   market_items ← /market .supply-card / .demand-card（tags=span 文本, h3=title, p=summary,
 *                  sc-author-name / dc-user h4=org_name, sc-date / dc-time=published_at(北京时间)）
 *
 * 幂等策略：每张表**已有数据就整表跳过**（不覆盖运营后续修改）；空表才插入。
 * slug 规则：opc-agent-NNN / opc-course-NN / opc-supply-NN / opc-demand-NN（确定性，可回溯）。
 *
 * 用法：
 *   node scripts/seed-baked-blocks.mjs --dry-run   # 只解析+打印计划，不连库
 *   node scripts/seed-baked-blocks.mjs             # 实写（需 NEXT_PUBLIC_SUPABASE_URL +
 *                                                 #      SUPABASE_SERVICE_ROLE_KEY）
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const dryRun = process.argv.includes('--dry-run');

/* 独立脚本不会自动读 .env（那是 next dev/start 的行为），这里手动加载。 */
for (const f of ['.env.local', '.env']) {
  const p = resolve(repoRoot, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*"?([^"\n]+)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const pages = JSON.parse(readFileSync(resolve(repoRoot, 'src/lib/opc/generated/pages.json'), 'utf8'));
const htmlOf = (p) => pages[p].html ?? pages[p];

/* ── 解析工具 ───────────────────────────────────────────────────────────── */

const attr = (tag, name) => {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
};
const text = (html, pattern) => {
  const m = html.match(pattern);
  return m ? m[1].trim() : '';
};

/** 括号配平取块内 inner（与 src/lib/opc/blocks-runtime.ts 的语义一致，脚本侧重实现） */
function balancedInner(html, openPattern, openToken, closeToken) {
  const found = html.match(openPattern);
  if (!found || found.index === undefined) return null;
  let depth = 1;
  let cursor = found.index + found[0].length;
  while (depth > 0) {
    const nextOpen = html.indexOf(openToken, cursor);
    const nextClose = html.indexOf(closeToken, cursor);
    if (nextClose < 0) return null;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + openToken.length;
    } else {
      depth -= 1;
      if (depth === 0) return html.slice(found.index + found[0].length, nextClose);
      cursor = nextClose + closeToken.length;
    }
  }
  return null;
}

/* ── 1) partners：首页伙伴墙 ─────────────────────────────────────────────── */

function parsePartners() {
  const inner = balancedInner(htmlOf('/'), /<ul class="opc-visual-partner-grid"[^>]*>/, '<ul', '</ul>');
  if (!inner) throw new Error('首页伙伴墙结构未找到');
  return [...inner.matchAll(/<img[^>]*>/g)].map((m, i) => ({
    name: attr(m[0], 'alt') ?? '',
    logo_url: attr(m[0], 'src'),
    sort_order: i,
  })).filter((row) => row.name && row.logo_url);
}

/* ── 2) agents：/agent 分区卡 ────────────────────────────────────────────── */

/** 烘焙分区 label → agent_categories.slug；既有 7 类之外的 11 个分区补插。 */
const BASE_CATEGORY_SLUGS = {
  AI办公工具: 'office', AI写作工具: 'writing', AI编程工具: 'coding',
  AI设计工具: 'design', AI图像工具: 'image', AI视频工具: 'video', AI音频工具: 'audio',
};
const EXTRA_CATEGORIES = [
  { slug: 'hot', name: '热门工具' },
  { slug: 'agent', name: 'AI智能体' },
  { slug: 'search', name: 'AI搜索工具' },
  { slug: 'chat', name: 'AI聊天对话' },
  { slug: 'prompt', name: 'AI指令提示' },
  { slug: 'translate', name: 'AI翻译工具' },
  { slug: 'detect', name: 'AI内容检测' },
  { slug: 'legal', name: 'AI法律助手' },
  { slug: 'opensource', name: 'AI开源模型' },
  { slug: 'learning', name: 'AI学习网站' },
  { slug: 'framework', name: 'AI开发框架' },
];

function parseAgents() {
  const html = htmlOf('/agent');
  const labelToSlug = new Map([
    ...EXTRA_CATEGORIES.map((c) => [c.name, c.slug]),
    ...Object.entries(BASE_CATEGORY_SLUGS),
  ]);
  const rows = [];
  const sections = [...html.matchAll(/<section[^>]*data-opc-agent-group="([^"]*)"[^>]*>/g)];
  sections.forEach((sec, sectionIdx) => {
    const label = sec[1];
    const sectionInner = balancedInner(
      html.slice(sec.index + sec[0].length),
      /<div[^>]*class="tool-grid"[^>]*>/, '<div', '</div>',
    ) ?? '';
    const cards = [...sectionInner.matchAll(/<a[^>]*class="tool-card[^"]*"[^>]*>[\s\S]*?<\/a>/g)];
    cards.forEach((card, cardIdx) => {
      const href = attr(card[0], 'href') ?? '';
      if (!/^https:\/\//.test(href)) return; // 运行时 isSafeExternalUrl 同口径：非 https 会被跳过
      rows.push({
        slug: `opc-agent-${String(rows.length + 1).padStart(3, '0')}`,
        name: text(card[0], /class="tc-title">([^<]*)</) || '未命名智能体',
        category: labelToSlug.get(label) ?? 'agent',
        summary: text(card[0], /class="tc-desc">([^<]*)</) || text(card[0], /class="tc-title">([^<]*)</),
        icon_url: (card[0].match(/<img class="tc-icon" src="([^"]*)"/) || [])[1] ?? null,
        external_url: href,
        sort_order: sectionIdx * 1000 + cardIdx,
      });
    });
  });
  return rows;
}

/* ── 3) courses：/center 课程卡 ──────────────────────────────────────────── */

function parseCourses() {
  const inner = balancedInner(htmlOf('/center'), /<div class="opc-academy-course-grid">/, '<div', '</div>');
  if (!inner) throw new Error('/center 课程网格结构未找到');
  const cards = [...inner.matchAll(/<figure class="opc-academy-course-card">[\s\S]*?<\/figure>/g)];
  return cards.map((card, i) => ({
    slug: `opc-course-${String(i + 1).padStart(2, '0')}`,
    track: text(card[0], /class="opc-academy-course-tag">([^<]*)</) || '精选方向',
    title: text(card[0], /<h3>([^<]*)<\/h3>/) || `课程方向 ${i + 1}`,
    summary: text(card[0], /<p>([^<]*)<\/p>/),
    cover_url: (card[0].match(/<img src="([^"]*)"/) || [])[1] ?? null,
    sort_order: i,
  })).filter((row) => row.title && row.summary);
}

/* ── 4) market_items：/market 供需卡 ─────────────────────────────────────── */

function parseMarket() {
  const html = htmlOf('/market');
  const rows = [];
  const parse = (gridPattern, cardPattern, type) => {
    const inner = balancedInner(html, gridPattern, '<div', '</div>');
    if (!inner) return;
    const cards = [...inner.matchAll(new RegExp(cardPattern.source, 'g'))];
    cards.forEach((card, i) => {
      const tags = [...card[0].matchAll(/class="[sd]c-tag">([^<]*)</g)].map((t) => t[1].trim()).filter(Boolean);
      const date = text(card[0], /class="[sd]c-(?:date|time)">([^<]*)</) || '2026/6/1';
      const [y, m, d] = date.split('/').map(Number);
      const iso = y && m && d
        ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00+08:00`
        : null;
      const title = text(card[0], /class="[sd]c-title">([^<]*)</);
      const summary = text(card[0], /class="[sd]c-desc">([^<]*)</);
      if (!title || !summary) return;
      rows.push({
        slug: `opc-${type}-${String(i + 1).padStart(2, '0')}`,
        type,
        category: tags[0] ?? '综合',
        title,
        summary,
        org_name: text(card[0], /class="sc-author-name">([^<]*)</) || text(card[0], /<h4[^>]*>([^<]*)<\/h4>/) || null,
        tags: tags.slice(0, 4),
        published_at: iso,
      });
    });
  };
  parse(/<div[^>]*class="supply-grid"[^>]*>/, /<article[^>]*class="supply-card"[\s\S]*?<\/article>/, 'supply');
  parse(/<div[^>]*class="demand-grid"[^>]*>/, /<article[^>]*class="demand-card"[\s\S]*?<\/article>/, 'demand');
  return rows;
}

/* ── 计划与执行 ─────────────────────────────────────────────────────────── */

const partners = parsePartners();
const agents = parseAgents();
const courses = parseCourses();
const marketItems = parseMarket();

console.log(`解析：partners=${partners.length} agents=${agents.length} courses=${courses.length} market=${marketItems.length}（supply=${marketItems.filter((r) => r.type === 'supply').length} demand=${marketItems.filter((r) => r.type === 'demand').length}）`);

if (dryRun) {
  console.log('\n[dry-run] 样例：');
  console.log('partner[0]:', JSON.stringify(partners[0]));
  console.log('agent[0]:', JSON.stringify(agents[0]));
  console.log('agent[-1]:', JSON.stringify(agents.at(-1)));
  console.log('course[0]:', JSON.stringify(courses[0]));
  console.log('market[0]:', JSON.stringify(marketItems[0]));
  console.log('market[demand][0]:', JSON.stringify(marketItems.find((r) => r.type === 'demand')));
  console.log('新增分类:', JSON.stringify(EXTRA_CATEGORIES.map((c) => `${c.slug}:${c.name}`)));
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✗ 未配置 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（自动降级：请先 dry-run 核对，再配置环境变量实写）');
  process.exit(2);
}
const sb = createClient(url, key);

async function countOf(table) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`${table} 计数失败：${error.message}`);
  return count ?? 0;
}

async function seedTable(table, rows, columns) {
  const existing = await countOf(table);
  if (existing > 0) {
    console.log(`= ${table}：已有 ${existing} 行，跳过（不覆盖既有数据）`);
    return 0;
  }
  if (rows.length === 0) { console.log(`= ${table}：解析为空，无操作`); return 0; }
  const { error } = await sb.from(table).insert(rows.map((row) => ({ ...row, published: true })));
  if (error) throw new Error(`${table} 插入失败：${error.message}`);
  console.log(`+ ${table}：插入 ${rows.length} 行`);
  return rows.length;
}

/* agent_categories：既有 7 类之外补插烘焙用到的 11 类（onConflict DO NOTHING） */
{
  const { error } = await sb
    .from('agent_categories')
    .upsert(EXTRA_CATEGORIES.map((c, i) => ({ slug: c.slug, name: c.name, sort_order: 7 + i + 1 })), { onConflict: 'slug', ignoreDuplicates: true });
  if (error) throw new Error(`agent_categories 补插失败：${error.message}`);
  console.log(`+ agent_categories：确保 ${EXTRA_CATEGORIES.length} 个烘焙分类存在`);
}

await seedTable('partners', partners);
await seedTable('agents', agents);
await seedTable('courses', courses);
await seedTable('market_items', marketItems);

console.log('\n完成。');
