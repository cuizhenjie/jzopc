#!/usr/bin/env node
/**
 * 品牌文案替换映射审计 —— 零依赖。
 *
 * 目的：在实施替换前，把「同橙 / OPC Store / 同橙OPC社区 / 同橙AI学院」
 * 的每一种上下文穷举出来，确保映射表覆盖完整、不误伤业务概念词「OPC」。
 *
 * 用法：node scripts/opc-brand-audit.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const generated = resolve(root, 'src/lib/opc/generated');

const files = ['pages.json', 'details.json', 'article-shell.json', 'zone-cities.json', 'directory.json', 'listings.json'];
const blobs = [];
for (const name of files) {
  try {
    const raw = readFileSync(resolve(generated, name), 'utf8');
    blobs.push([name, raw]);
  } catch { /* 文件不存在则跳过 */ }
}

/** 剥离标签后取纯文本，用于判断品牌词出现在什么语境 */
function textOf(raw) {
  return raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\\u([\da-f]{4})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, ' ');
}

const patterns = ['同橙', 'OPC Store', 'OPCStore', 'opcstore', 'OPC社区', 'OPC 社区',
  // 原站域名与运营方身份信息 —— 同样是「原运营方」的一部分
  'tongcc', 'tongcheng', '025-86551126', '苏ICP备2026012874号'];
console.log('════════ 品牌词上下文穷举 ════════\n');

const contexts = new Map(); // 品牌词 -> Set(上下文片段)
for (const [name, raw] of blobs) {
  const text = textOf(raw);
  for (const word of patterns) {
    let index = -1;
    while ((index = text.indexOf(word, index + 1)) >= 0) {
      const fragment = text.slice(Math.max(0, index - 30), index + word.length + 30).trim();
      if (!contexts.has(word)) contexts.set(word, new Set());
      contexts.get(word).add(fragment);
    }
  }
}

for (const word of patterns) {
  const set = contexts.get(word) || new Set();
  console.log(`【${word}】唯一上下文 ${set.size} 种`);
  let shown = 0;
  for (const fragment of set) {
    if (shown >= 10) break;
    console.log(`   …${fragment}…`);
    shown += 1;
  }
  if (set.size > shown) console.log(`   …（另有 ${set.size - shown} 种未展示）`);
  console.log('');
}

/* ── 替换映射表 ────────────────────────────────────────────────────── */
console.log('════════ 建议替换映射表 ════════\n');

/**
 * 规则按顺序应用，长的先匹配。
 * 关键原则：**保留 OPC 作为业务概念词**（One Person Company / 一人公司），
 * 只替换原运营方品牌名「同橙」与站点名「OPC Store」。
 */
const RULES = [
  // 站点名与运营方品牌：先处理最长、最具体的组合
  ['同橙OPC社区平台', '集智AI OPC社区平台'],
  ['同橙 OPC 社区平台', '集智AI OPC 社区平台'],
  ['同橙OPC社区', '集智AI OPC社区'],
  ['同橙 OPC 社区', '集智AI OPC 社区'],
  ['同橙OPC', '集智AI OPC'],
  ['同橙 AI 学院', '集智AI 学院'],
  ['同橙AI学院', '集智AI学院'],
  ['同橙科创产业板块', '集智AI 产业板块'],
  ['同橙科创产业发展集团', '集智AI 产业发展集团'],
  ['同橙', '集智AI'],
  // 站点名
  ['OPC Store', '集智AI'],
  ['OPCStore', '集智AI'],
  // 原站域名（tongcc = 同橙）：文字与 href 都要换
  ['https://www.tongcc.com', 'https://t.3cool.cc'],
  ['www.tongcc.com', 't.3cool.cc'],
];

let total = 0;
for (const [from, to] of RULES) {
  let count = 0;
  for (const [name, raw] of blobs) {
    count += raw.split(from).length - 1;
  }
  total += count;
  if (count) console.log(`  ${from.padEnd(24)} → ${to.padEnd(20)} ${count} 处`);
}
console.log(`\n  合计替换 ${total} 处`);

/* ── 替换后仍需人工确认的残留 ──────────────────────────────────────── */
console.log('\n════════ 替换后仍残留的「OPC」用法 ════════\n');
console.log('  说明：OPC 在本站是业务概念词（One Person Company / 一人公司），');
console.log('  与品牌名无关，**不应**被替换。以下列出需确认的特例：\n');

const after = blobs.map(([, raw]) => raw.split('同橙').join('\u0000').split('OPC Store').join('\u0000').split('OPCStore').join('\u0000')).join('\n');
const suspicious = [];
for (const [name, raw] of blobs) {
  const text = textOf(raw);
  const re = /OPC\s*(Store|社区)/g;
  let m;
  while ((m = re.exec(text))) {
    const fragment = text.slice(Math.max(0, m.index - 25), m.index + m[0].length + 25).trim();
    if (!suspicious.includes(fragment)) suspicious.push(fragment);
  }
}
const uniqueSuspicious = [...new Set(suspicious)];
console.log(`  含「OPC Store / OPC社区」但未被上表覆盖的上下文：${uniqueSuspicious.length} 种`);
uniqueSuspicious.slice(0, 15).forEach((s) => console.log(`   …${s}…`));
if (uniqueSuspicious.length > 15) console.log(`   …（另有 ${uniqueSuspicious.length - 15} 种未展示）`);
