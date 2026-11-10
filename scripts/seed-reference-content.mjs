#!/usr/bin/env node
/**
 * 参考站内容 → 数据库 种子脚本（一次性，幂等）。
 *
 * 背景：2026-11-10 全站复刻后，公开内容的事实源是参考站快照
 * （scripts/opc-reference/ → generated/pages.json）。但**动态维护能力**要保住，
 * 所以这些内容必须进后台表，才能在 /admin 里继续编辑、发布、下架。
 *
 * 数据映射：
 *   news_posts   ← /news 的 article.nitem（标题/摘要/类目/日期/正文段落/封面）
 *   courses      ← /academy 的 .ac-crs__i（课程名/说明/标签/配图）
 *   site_stats   ← /about 的 .kpis（数字/单位/说明）
 *   agents       ← 参考站 assets/js/agents.js 的 233 个智能体（18 个分类）
 *   agent_categories ← 参考站 18 个分类（slug 化，与 site/config.ts agentCategories 同源）
 *
 * 幂等策略：每张表**已有数据就整表跳过**（不覆盖运营后续修改）；空表才插入。
 *
 * 用法：
 *   node scripts/seed-reference-content.mjs --dry-run   # 只解析+打印计划，不连库
 *   node scripts/seed-reference-content.mjs             # 实写
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
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

/* ── 解析工具 ──────────────────────────────────────────────────────────── */

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(html, name) {
  const m = html.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : '';
}

const pages = JSON.parse(readFileSync(resolve(repoRoot, 'src/lib/opc/generated/pages.json'), 'utf8'));

/* ── 1) news_posts：/news 的折叠卡 ─────────────────────────────────────── */

function parseNews() {
  const html = pages['/news']?.html ?? '';
  const articles = html.split(/<article class="nitem/).slice(1);
  return articles.map((raw, index) => {
    const body = raw.slice(0, raw.indexOf('</article>'));
    const dateBlock = body.match(/<div class="nitem__date">([\s\S]*?)<\/div>/)?.[1] ?? '';
    const day = stripTags(dateBlock.match(/<b>([\s\S]*?)<\/b>/)?.[1] ?? '');
    const month = stripTags(dateBlock.match(/<span>([\s\S]*?)<\/span>/)?.[1] ?? '');
    const cover = attr(body.match(/<div class="nitem__ph">([\s\S]*?)<\/div>/)?.[1] ?? '', 'src');
    const bd = body.match(/<div class="nitem__bd">([\s\S]*?)<\/div>\s*<span class="nitem__more"/)?.[1] ?? '';
    const category = stripTags(bd.match(/<span class="ntag">([\s\S]*?)<\/span>/)?.[1] ?? '');
    const title = stripTags(bd.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] ?? '');
    const summary = stripTags(bd.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '');
    const bodyBlock = body.match(/<div class="nitem__body">([\s\S]*)$/)?.[1] ?? '';
    const paragraphs = [...bodyBlock.matchAll(/<p(?![^>]*class="nsrc")[^>]*>([\s\S]*?)<\/p>/g)]
      .map((m) => stripTags(m[1]))
      .filter(Boolean);
    const source = bodyBlock.match(/<p class="nsrc">([\s\S]*?)<\/p>/)?.[1] ?? '';
    const sourceText = stripTags(source);
    const sourceHref = attr(source.match(/<a[^>]*href="([^"]*)"/)?.[0] ?? '', 'href');
    if (sourceText) paragraphs.push(`转载自：${sourceText}${sourceHref ? ` ${sourceHref}` : ''}`);
    return {
      slug: `opc-ref-${String(index + 1).padStart(2, '0')}`,
      title,
      summary,
      category,
      published_at: `${month}-${day.padStart(2, '0')}T09:00:00+08:00`,
      cover_url: cover || null,
      body: paragraphs,
      status: 'published',
    };
  }).filter((r) => r.title);
}

/* ── 2) courses：/academy 的课程卡 ──────────────────────────────────────── */

function parseCourses() {
  const html = pages['/academy']?.html ?? '';
  const cards = html.split(/<a class="ac-crs__i/).slice(1);
  return cards.map((raw, index) => {
    const body = raw.slice(0, raw.indexOf('</a>'));
    const cover = attr(body.match(/<div class="ac-crs__ph">([\s\S]*?)<\/div>/)?.[1] ?? '', 'src');
    const title = stripTags(body.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] ?? '');
    const summary = stripTags(body.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '');
    const track = stripTags(body.match(/<span class="tag">([\s\S]*?)<\/span>/)?.[1] ?? '');
    return {
      slug: `opc-ref-course-${String(index + 1).padStart(2, '0')}`,
      title,
      summary,
      track: track || null,
      cover_url: cover || null,
      published: true,
      sort_order: index,
    };
  }).filter((r) => r.title);
}

/* ── 3) site_stats：/about 的 KPI 数字 ──────────────────────────────────── */

/** 取某个开标签的**配平内部**（div 计数），避免非贪婪正则截断。 */
function balancedInner(html, openPattern, tagName = 'div') {
  const found = html.match(openPattern);
  if (!found || found.index === undefined) return '';
  const start = found.index + found[0].length;
  let depth = 1;
  let cursor = start;
  while (depth > 0) {
    const openAt = html.indexOf(`<${tagName}`, cursor);
    const closeAt = html.indexOf(`</${tagName}>`, cursor);
    if (closeAt < 0) return html.slice(start);
    if (openAt >= 0 && openAt < closeAt) {
      depth += 1;
      cursor = openAt + tagName.length + 1;
    } else {
      depth -= 1;
      cursor = closeAt + tagName.length + 3;
      if (depth === 0) return html.slice(start, closeAt);
    }
  }
  return html.slice(start);
}

function parseSiteStats() {
  const html = pages['/about']?.html ?? '';
  const kpis = balancedInner(html, /<div class="kpis">/);
  return [...kpis.matchAll(/<div><b>([\s\S]*?)<\/b><span>([\s\S]*?)<\/span><\/div>/g)].map((m, index) => {
    const raw = stripTags(m[1]);
    const num = Number.parseInt(raw.replace(/[^\d]/g, ''), 10);
    const suffix = raw.replace(/[\d\s]/g, '');
    return {
      value: Number.isFinite(num) ? num : 0,
      suffix: suffix || null,
      label: stripTags(m[2]),
      sort_order: index,
    };
  });
}

/* ── 4) agents：参考站 agents.js ───────────────────────────────────────── */

/** 参考站分类中文名 → 后台 slug（与 src/lib/site/config.ts 的 agentCategories、
 *  以及数据库 agent_categories 表**逐字一致**——slug 对不上前台 chips 会显示英文原文）。 */
const CATEGORY_SLUGS = {
  热门工具: 'hot',
  AI智能体: 'agent',
  AI办公工具: 'office',
  AI写作工具: 'writing',
  AI搜索工具: 'search',
  AI编程工具: 'coding',
  AI聊天对话: 'chat',
  AI音频工具: 'audio',
  AI视频工具: 'video',
  AI图像工具: 'image',
  AI设计工具: 'design',
  AI指令提示: 'prompt',
  AI翻译工具: 'translate',
  AI内容检测: 'detect',
  AI法律助手: 'legal',
  AI开源模型: 'opensource',
  AI学习网站: 'learning',
  AI开发框架: 'framework',
};

function parseAgents() {
  const source = readFileSync(resolve(repoRoot, 'scripts/opc-reference/assets/js/agents.js'), 'utf8');
  const json = source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1);
  const data = JSON.parse(json);
  const rows = [];
  let order = 0;
  for (const cat of data.cats ?? []) {
    const slug = CATEGORY_SLUGS[cat.name] ?? 'ai-agents';
    for (const item of cat.items ?? []) {
      const url = /^https?:\/\//i.test(item.u) ? item.u : `https://${item.u}`;
      rows.push({
        slug: `opc-ref-agent-${String(order + 1).padStart(3, '0')}`,
        name: item.n,
        category: slug,
        summary: item.d,
        description: item.d,
        external_url: url,
        tags: [cat.name],
        sort_order: order,
        published: true,
        featured: false,
      });
      order += 1;
    }
  }
  return { rows, categories: Object.entries(CATEGORY_SLUGS).map(([name, slug], index) => ({ slug, name, sort_order: index })) };
}

/* ── 灌库 ──────────────────────────────────────────────────────────────── */

async function seedTable(sb, table, rows) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
  if (error) {
    console.error(`[seed] ${table} 计数失败：${error.message}`);
    return;
  }
  if ((count ?? 0) > 0) {
    console.log(`[skip] ${table} 已有 ${count} 行，跳过（不覆盖运营修改）`);
    return;
  }
  if (!rows.length) {
    console.log(`[skip] ${table} 没有可灌入的行`);
    return;
  }
  const { error: insertError } = await sb.from(table).insert(rows);
  if (insertError) {
    console.error(`[fail] ${table} 写入失败：${insertError.message}`);
    return;
  }
  console.log(`[ok]   ${table} 写入 ${rows.length} 行`);
}

async function main() {
  const news = parseNews();
  const courses = parseCourses();
  const siteStats = parseSiteStats();
  const { rows: agents, categories } = parseAgents();

  console.log(`解析：news=${news.length} courses=${courses.length} site_stats=${siteStats.length} agents=${agents.length} categories=${categories.length}`);
  if (dryRun) {
    console.log('news[0]:', JSON.stringify(news[0], null, 1).slice(0, 600));
    console.log('course[0]:', JSON.stringify(courses[0]));
    console.log('stat[0]:', JSON.stringify(siteStats[0]));
    console.log('agent[0]:', JSON.stringify(agents[0]));
    console.log('\n--dry-run：未连库');
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exitCode = 1;
    return;
  }
  const sb = createClient(url, key);

  await seedTable(sb, 'agent_categories', categories);
  await seedTable(sb, 'news_posts', news);
  await seedTable(sb, 'courses', courses);
  await seedTable(sb, 'site_stats', siteStats);
  await seedTable(sb, 'agents', agents);

  console.log('\n完成。刷新前台对应页面即可看到内容（ISR 最长 300s）。');
}

main().catch((error) => {
  console.error('种子脚本失败：', error);
  process.exitCode = 1;
});
