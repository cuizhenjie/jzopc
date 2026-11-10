#!/usr/bin/env node
/**
 * 数据库内容对齐参考站（2026-11-10 全站复刻后的一次性对齐）。
 *
 * ## 为什么需要
 *
 * 库里原本是**旧 opcstore 复刻管线**灌入的内容（110 篇旧动态、5 门旧课程、
 * 16 家合作企业、22 条旧供需、4 项旧口径统计）。前台外壳已经换成参考站后，
 * 动态区块会继续渲染旧站内容 —— 与参考站的文案/素材口径不一致。
 *
 * 本脚本做四件事：
 *   1. **备份**：把将要改动的表整表导出到 `.db-backup/`（不入库，可随时回滚）；
 *   2. **courses**：换成参考站的 4 门课（AI电商 / AIGC / AI漫剧 / 大数据工程师），
 *      封面改指向参考站素材 `/opc/reference/img/course-*.jpg`；
 *   3. **news_posts**：旧 110 篇**归档**（status=archived，不删除、可回滚），
 *      插入参考站的 5 篇（正文段落来自参考站 `.nitem__body`）；
 *   4. **site_stats**：清空旧口径数字（500+ 入驻智能体 / 1000+ 活跃创业者 / …）——
 *      参考站首页 hero 统计墙本身是空的，且这些数字与当前库内实际条目数对不上；
 *      清空后运营可在后台「统计数字」模块随时补。
 *
 * **不动**：agents / agent_categories（233 个智能体与参考站 agents.js 完全一致，
 * 分类 slug 也已对齐）、partners（16 家真实品牌，参考站无对应名单，属运营内容）、
 * market_items（运营内容）。
 *
 * 用法：
 *   node scripts/sync-reference-content.mjs --dry-run   # 只解析+打印计划，不连库
 *   node scripts/sync-reference-content.mjs             # 实写（先自动备份）
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseReferenceNews } from './reference-news-content.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const dryRun = process.argv.includes('--dry-run');
const BACKUP_DIR = resolve(repoRoot, '.db-backup');

for (const f of ['.env.local', '.env']) {
  const p = resolve(repoRoot, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

/* ── 参考站内容解析（与 seed-reference-content.mjs 同源）────────────────── */

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(html, name) {
  const m = html.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : '';
}

const pages = JSON.parse(readFileSync(resolve(repoRoot, 'src/lib/opc/generated/pages.json'), 'utf8'));

/** 参考站 /academy 的课程卡 → courses 行（封面用参考站素材） */
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
      track: track || '',   // 表定义 track NOT NULL
      cover_url: cover || null,
      published: true,
      sort_order: index,
    };
  }).filter((r) => r.title);
}

/** 参考站 /news → 保留完整 HTML 的 news_posts 行 */
function parseNews() {
  return parseReferenceNews(pages['/news']?.html ?? '');
}

/* ── 备份 ──────────────────────────────────────────────────────────────── */

async function backup(sb, tables) {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dump = {};
  for (const table of tables) {
    const { data, error } = await sb.from(table).select('*');
    if (error) throw new Error(`备份 ${table} 失败：${error.message}`);
    dump[table] = data ?? [];
  }
  const file = resolve(BACKUP_DIR, `before-reference-sync-${stamp}.json`);
  writeFileSync(file, JSON.stringify(dump, null, 1), 'utf8');
  console.log(`[backup] ${Object.entries(dump).map(([t, rows]) => `${t}=${rows.length}`).join(' ')} → ${file.replace(repoRoot + '/', '')}`);
  return file;
}

/* ── 主流程 ────────────────────────────────────────────────────────────── */

async function main() {
  const courses = parseCourses();
  const news = parseNews();

  console.log(`解析：courses=${courses.length} news=${news.length}`);
  if (dryRun) {
    console.log('course[0]:', JSON.stringify(courses[0]));
    console.log('news[0]:', JSON.stringify({ ...news[0], body: `${news[0].body.length} 段` }));
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

  await backup(sb, ['courses', 'news_posts', 'site_stats']);

  // 1) 旧动态归档（不删除）
  const { error: archiveError } = await sb
    .from('news_posts')
    .update({ status: 'archived' })
    .in('status', ['published', 'draft']);
  if (archiveError) {
    console.error(`[fail] 归档旧动态失败：${archiveError.message}`);
    process.exitCode = 1;
    return;
  }
  console.log('[ok]   旧动态已归档（status=archived，数据保留可回滚）');

  // 2) 旧课程下架 + 插入参考站课程
  // 只下架**旧管线**的课程（slug 前缀 opc-course-），不动参考站课程
  const { error: courseOffError } = await sb
    .from('courses')
    .update({ published: false })
    .like('slug', 'opc-course-%');
  if (courseOffError) {
    console.error(`[fail] 旧课程下架失败：${courseOffError.message}`);
    process.exitCode = 1;
    return;
  }
  const { error: courseError } = await sb.from('courses').upsert(courses, { onConflict: 'slug' });
  if (courseError) {
    console.error(`[fail] 插入参考站课程失败：${courseError.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[ok]   课程已对齐参考站（${courses.length} 门已发布，旧课程下架）`);

  // 3) 插入参考站动态
  const { error: newsError } = await sb.from('news_posts').upsert(news, { onConflict: 'slug' });
  if (newsError) {
    console.error(`[fail] 插入参考站动态失败：${newsError.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`[ok]   动态已对齐参考站（${news.length} 篇已发布）`);

  // 4) 清空旧口径统计
  const { error: statError } = await sb.from('site_stats').delete().neq('key', '__never_match__');
  if (statError) {
    console.error(`[fail] 清空旧统计失败：${statError.message}`);
    process.exitCode = 1;
    return;
  }
  console.log('[ok]   旧口径统计已清空（后台「统计数字」模块可随时补）');

  console.log('\n完成。ISR 最长 300s 后前台生效（也可重启 next start 立即生效）。');
}

main().catch((error) => {
  console.error('对齐脚本失败：', error);
  process.exitCode = 1;
});
