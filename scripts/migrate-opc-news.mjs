#!/usr/bin/env node
/**
 * OPC 抓包快照 → news_posts 迁移脚本（Worker A）。
 *
 * 契约：docs/14-动态内容契约.md §3（数据映射）。
 *
 * 来源：scripts/opc-source/public-content.json 的 records（dict，键为字符串 id），
 * 筛选 category_id ∈ {10, 16}（10→news / 16→activity，
 * 语义同 src/lib/opc/taxonomy.ts 的 LEGACY_CHANNEL_BY_CATEGORY_ID）。
 *
 * 行映射（表结构见 supabase/migrations/0001_init.sql 的 news_posts）：
 *   slug         = `opc-<原id>`（LEGACY_SLUG_PREFIX）
 *   title        = 原 title 经 rebrand() 品牌替换（规则移植自 build-opc-content.py）
 *   summary      = subtitle_list 中 sort==1 的 content（同样 rebrand）
 *   body         = content 数组中 sort != -1 的项按 sort 升序取 content（同样 rebrand）
 *   cover_url    = head_image[0].url 经 asset-map.json 映射为本地 /opc/assets/...（无映射留空）
 *   category     = 10→资讯 / 16→活动（DEFAULT_CATEGORY_BY_CHANNEL）
 *   status       = 'published'；author = '集智 AI'
 *   published_at = create_time（epoch 秒）→ ISO 字符串
 *
 * ⚠️ 品牌替换应用于 title / summary / body 全部文本字段：
 * 契约 §2 的兜底卡片样例里 summary 已是「集智 AI OPC 社区承办…」的替换后文本，
 * 构建管线对列表（rebrand_tree_deep(listings)）与详情正文（rebrand_tree）也是全量替换；
 * DB 卡片若只换 title 会把原运营方品牌（同橙）漏到线上列表/详情里。
 * 替换对与短路条件从 build-opc-content.py 的 BRAND_RULES / BRAND_MARKERS / rebrand()
 * 原样移植，语义一致（Python str.replace 全量替换 ↔ String.replaceAll）。
 * 注意：cover_url 的查表用**原始远程 URL**（不做品牌替换）——asset-map.json 的键是
 * 原站地址，与 build-opc-content.py 里「媒体 URL 不做品牌替换」的理由相同。
 *
 * 用法：
 *   node scripts/migrate-opc-news.mjs --dry-run   # 只解析+映射+打印计划，不连库
 *   node scripts/migrate-opc-news.mjs             # 实写（需 NEXT_PUBLIC_SUPABASE_URL +
 *                                                 #      SUPABASE_SERVICE_ROLE_KEY，见
 *                                                 #      src/lib/supabase/server.ts；
 *                                                 #      未配置时自动降级为 dry-run）
 *
 * 实写幂等：upsert onConflict 'slug' + ignoreDuplicates（ON CONFLICT DO NOTHING，
 * 不覆盖已有行），结束打印 inserted / skipped 统计。
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// 独立脚本不会自动读 .env（那是 next dev/start 的行为），这里手动加载，
// 免得配了 .env 仍连不上库。
import './lib/load-env.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const SOURCE_PATH = resolve(repoRoot, 'scripts/opc-source/public-content.json');
const ASSET_MAP_PATH = resolve(repoRoot, 'scripts/opc-source/asset-map.json');

/* ── 品牌替换（build-opc-content.py rebrand() 的移植）─────────────────── */

// 本站站点信息 —— 与 build-opc-content.py / src/lib/site/config.ts 的常量保持一致。
const SITE_URL = 'https://www.jizhiai.net.cn';
const SITE_DOMAIN = 'www.jizhiai.net.cn';
const SITE_ADDRESS = '北京市丰台区西马场甲14号';

// 规则按「长 → 短」排列，先命中更具体的组合，避免「同橙」先被吃掉
// 导致「同橙OPC社区」被拆成不一致的碎片结果。（替换对与 Python 版逐条一致，勿调序）
export const BRAND_RULES = [
  ['同橙OPC社区平台', '集智 AI OPC 社区'],
  ['同橙 OPC 社区平台', '集智 AI OPC 社区'],
  ['同橙OPC社区', '集智 AI OPC 社区'],
  ['同橙 OPC 社区', '集智 AI OPC 社区'],
  ['同橙OPC', '集智 AI OPC'],
  // 只匹配带「江苏省」前缀的完整词组，正文里作为政策概念引用的「瞪羚企业」保持原样。
  ['江苏省瞪羚企业', '中关村高新'],
  ['同橙 AI 学院', '集智AI 学院'],
  ['同橙AI学院', '集智AI学院'],
  ['同橙科创产业发展集团', '集智AI 产业发展集团'],
  ['同橙科创产业板块', '集智AI 产业板块'],
  ['同橙', '集智AI'],
  ['OPC Store', '集智AI'],
  ['OPCStore', '集智AI'],
  ['tongcheng.ai', SITE_DOMAIN],
  // 长地址在前，避免留下「…智梦园B座」这种拼接残渣。
  ['南京市鼓楼区古平岗4号智梦园B座', SITE_ADDRESS],
  ['南京市鼓楼区古平岗4号', SITE_ADDRESS],
  ['https://www.tongcc.com', SITE_URL],
  ['http://www.tongcc.com', SITE_URL],
  ['www.tongcc.com', SITE_DOMAIN],
  ['tongcc.com', SITE_DOMAIN],
  ['https://t.3cool.cc', SITE_URL],
  ['http://t.3cool.cc', SITE_URL],
  ['t.3cool.cc', SITE_DOMAIN],
  // 城市子域名必须先于 ai.opcstore.com 消化（顺序依赖，勿调序）。
  ['https://shanghai.opcstore.com', SITE_URL],
  ['shanghai.opcstore.com', SITE_DOMAIN],
  ['https://nanjing.opcstore.com', SITE_URL],
  ['nanjing.opcstore.com', SITE_DOMAIN],
  ['https://ai.opcstore.com', 'https://th.jimei.cn'],
  ['http://ai.opcstore.com', 'https://th.jimei.cn'],
  ['ai.opcstore.com', 'th.jimei.cn'],
];

// 需要品牌替换的标记（rebrand() 的短路条件，与 Python 版一致）
export const BRAND_MARKERS = [
  '同橙', 'OPC Store', 'OPCStore', 'tongcc', 'tongcheng',
  '南京市鼓楼区古平岗4号', 't.3cool.cc', 'ai.opcstore.com',
  'nanjing.opcstore.com', 'shanghai.opcstore.com', '江苏省瞪羚企业',
];

/** 品牌替换：规则对原样移植自 build-opc-content.py 的 rebrand()，替换语义一致。 */
export function rebrand(text) {
  if (!text || !BRAND_MARKERS.some((marker) => text.includes(marker))) return text;
  let out = text;
  for (const [source, target] of BRAND_RULES) {
    if (out.includes(source)) out = out.replaceAll(source, target); // Python str.replace = 全量替换
  }
  return out;
}

/* ── 类目映射（语义同 src/lib/opc/taxonomy.ts，mjs 里复刻常量）────────── */

/** 快照 category_id → 列表页分流（LEGACY_CHANNEL_BY_CATEGORY_ID） */
export const LEGACY_CHANNEL_BY_CATEGORY_ID = { 10: 'news', 16: 'activity' };

/** 迁移快照入库时的默认类目（DEFAULT_CATEGORY_BY_CHANNEL） */
export const DEFAULT_CATEGORY_BY_CHANNEL = { news: '资讯', activity: '活动' };

/** 快照迁移入库的 slug 前缀（LEGACY_SLUG_PREFIX） */
export const LEGACY_SLUG_PREFIX = 'opc-';

/* ── 纯映射：快照 → news_posts 行 ─────────────────────────────────────── */

/** create_time（epoch 秒）→ ISO 字符串（无效值返回 null） */
export function epochSecondsToIso(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

/** head_image[0].url → 本地素材路径；无映射返回 ''（留空，不编造） */
export function localizeCover(headImage, assetMap) {
  const url = Array.isArray(headImage) && headImage[0] ? headImage[0].url : null;
  if (!url) return '';
  // 查表用原始远程 URL：asset-map 的键是原站地址，品牌替换会破坏查表。
  return typeof assetMap[url] === 'string' ? assetMap[url] : '';
}

/**
 * 把一条快照 record 映射为 news_posts 行；不属于 {10,16} 的类目返回 null。
 * @returns {{ slug, title, summary, body, cover_url, category, author, status, published_at } | null}
 */
export function mapRecordToRow(record, assetMap) {
  const channel = LEGACY_CHANNEL_BY_CATEGORY_ID[record?.category_id];
  if (!channel) return null;

  const summaryEntry = (record.subtitle_list ?? []).find((item) => item.sort === 1);
  const body = (record.content ?? [])
    .filter((item) => item.sort !== -1)
    .sort((a, b) => a.sort - b.sort)
    .map((item) => rebrand(item.content));

  return {
    slug: `${LEGACY_SLUG_PREFIX}${record.id}`,
    title: rebrand(record.title),
    summary: summaryEntry ? rebrand(summaryEntry.content) : '',
    body,
    cover_url: localizeCover(record.head_image, assetMap),
    category: DEFAULT_CATEGORY_BY_CHANNEL[channel],
    author: '集智 AI',
    status: 'published',
    published_at: epochSecondsToIso(record.create_time),
  };
}

/**
 * 构建完整迁移计划（纯函数，不碰文件系统、不连库 —— 单测直接调用）。
 * @param {object} snapshot public-content.json 解析后的对象（用其 records 与 categories）
 * @param {Record<string, string>} assetMap asset-map.json 解析后的对象
 * @returns {{ rows: object[], stats: { total, byChannel: { news: number, activity: number },
 *            unmappedCovers: number, expectedByCategory: Record<string, number> } }}
 */
export function buildMigrationPlan(snapshot, assetMap) {
  const records = Object.values(snapshot.records ?? {});
  const rows = [];
  const byChannel = { news: 0, activity: 0 };
  let unmappedCovers = 0;

  for (const record of records) {
    const row = mapRecordToRow(record, assetMap);
    if (!row) continue;
    if (!row.cover_url) unmappedCovers += 1;
    byChannel[LEGACY_CHANNEL_BY_CATEGORY_ID[record.category_id]] += 1;
    rows.push({ id: record.id, row });
  }

  // 确定性排序：发布时间降序（同库内列表页的展示序），并列时 id 降序。
  rows.sort((a, b) => {
    const ta = a.row.published_at ?? '';
    const tb = b.row.published_at ?? '';
    if (ta !== tb) return tb.localeCompare(ta);
    return b.id - a.id;
  });

  const expectedByCategory = {};
  for (const [id, meta] of Object.entries(snapshot.categories ?? {})) {
    expectedByCategory[id] = meta?.total ?? 0;
  }

  return {
    rows: rows.map((entry) => entry.row),
    stats: { total: rows.length, byChannel, unmappedCovers, expectedByCategory },
  };
}

/* ── CLI ──────────────────────────────────────────────────────────────── */

function printPlan(plan) {
  const { rows, stats } = plan;
  console.log('── OPC 快照 → news_posts 迁移计划（dry-run）──');
  console.log(`总条数: ${stats.total}（news=${stats.byChannel.news} / activity=${stats.byChannel.activity}）`);
  console.log(`快照类目元数据: ${JSON.stringify(stats.expectedByCategory)}`);
  const mismatched = Object.entries(LEGACY_CHANNEL_BY_CATEGORY_ID)
    .filter(([id, channel]) => stats.expectedByCategory[id] !== stats.byChannel[channel])
    .map(([id, channel]) => `category ${id}→${channel}: 期望 ${stats.expectedByCategory[id]}，实得 ${stats.byChannel[channel]}`);
  if (mismatched.length) console.log(`⚠️ 与快照元数据不一致: ${mismatched.join('；')}`);
  else console.log('与快照 categories 元数据一致（10→88 / 16→22）');

  console.log(`封面未映射(将留空): ${stats.unmappedCovers}`);
  const badSlugs = rows.filter((r) => !new RegExp(`^${LEGACY_SLUG_PREFIX}\\d+$`).test(r.slug));
  if (badSlugs.length) console.log(`⚠️ slug 异常条数: ${badSlugs.length}`);
  const missingDate = rows.filter((r) => !r.published_at).length;
  if (missingDate) console.log(`⚠️ 缺 published_at: ${missingDate}`);

  console.log('\n示例行（news 前 2 + activity 前 2）:');
  const examples = [...rows.filter((r) => r.category === DEFAULT_CATEGORY_BY_CHANNEL.news).slice(0, 2),
    ...rows.filter((r) => r.category === DEFAULT_CATEGORY_BY_CHANNEL.activity).slice(0, 2)];
  for (const row of examples) {
    console.log(`  [${row.category}] slug=${row.slug} published_at=${row.published_at}`);
    console.log(`    title=${row.title}`);
    console.log(`    cover=${row.cover_url || '(空)'} summary=${row.summary.slice(0, 60)}…`);
    console.log(`    body 段落数=${row.body.length}，首段前 80 字=${row.body[0]?.slice(0, 80) ?? '(空)'}…`);
  }
}

async function runWrite(plan) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('未配置 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY —— 降级为 dry-run，不连库。');
    printPlan(plan);
    return;
  }
  // service_role key 必须存在才允许实写（上方已保证）；匿名 key 不用于迁移。
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const BATCH = 25;
  let inserted = 0;
  for (let i = 0; i < plan.rows.length; i += BATCH) {
    const chunk = plan.rows.slice(i, i + BATCH);
    // 幂等：ON CONFLICT(slug) DO NOTHING —— ignoreDuplicates 不覆盖已有行。
    // 默认 return=representation：返回的 data 只含真正插入的行，冲突行被丢弃。
    const { data, error } = await supabase
      .from('news_posts')
      .upsert(chunk, { onConflict: 'slug', ignoreDuplicates: true })
      .select('slug');
    if (error) {
      console.error(`✗ 写入失败（批次 ${Math.floor(i / BATCH) + 1}）：${error.message}`);
      process.exitCode = 1;
      return;
    }
    inserted += data?.length ?? 0;
  }
  const skipped = plan.rows.length - inserted;
  console.log(`── 实写完成 ──`);
  console.log(`计划: ${plan.stats.total}（news=${plan.stats.byChannel.news} / activity=${plan.stats.byChannel.activity}）`);
  console.log(`inserted=${inserted}  skipped(已存在,未覆盖)=${skipped}`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const snapshot = JSON.parse(readFileSync(SOURCE_PATH, 'utf8'));
  const assetMap = JSON.parse(readFileSync(ASSET_MAP_PATH, 'utf8'));
  const plan = buildMigrationPlan(snapshot, assetMap);

  if (dryRun) {
    printPlan(plan);
    return;
  }
  await runWrite(plan);
}

// 仅作为 CLI 直接执行时跑 main；被 import（单测）时不触发。
const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((err) => {
    console.error(`✗ ${err?.stack ?? err}`);
    process.exitCode = 1;
  });
}
