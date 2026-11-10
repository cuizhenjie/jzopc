#!/usr/bin/env node
/**
 * 抓取「集智 AI OPC 社区」参考站快照（scripts/opc-reference/）。
 *
 * 参考站：https://jizhi-ai-opc.app.workbuddy.host/
 * 该站所有路径都要求带 sharecode，否则返回 403「链接不完整」。
 *
 * 产出（全部入库，作为复刻内容的**唯一事实源**）：
 *   scripts/opc-reference/pages/<name>.html   页面 HTML（已剥离编辑器节点属性）
 *   scripts/opc-reference/assets/css/main.css 参考站样式基线
 *   scripts/opc-reference/assets/js/*.js      参考站交互脚本（人工审阅后移植）
 *   scripts/opc-reference/assets/img/*        参考站图片素材
 *
 * 运行时用的 CSS / 图片另由 scripts/build-opc-reference.mjs 同步到 public/opc/reference/。
 *
 * 用法：
 *   OPC_REFERENCE_SHARE_CODE=XXX node scripts/fetch-opc-reference.mjs
 *   node scripts/fetch-opc-reference.mjs --sharecode=XXX # 指定 sharecode
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://jizhi-ai-opc.app.workbuddy.host';

const PAGES = [
  'index',
  'about',
  'health',
  'empower',
  'market',
  'growth',
  'academy',
  'news',
  'join',
  'agent',
];

/** 页面文件名 → 抓取路径（参考站是 .html 后缀的静态站）。 */
const PAGE_PATHS = Object.fromEntries(PAGES.map((name) => [name, `${name}.html`]));

/** 参考站里除页面外的静态资源。 */
const ASSETS = [
  'assets/css/main.css',
  'assets/js/main.js',
  'assets/js/agents.js',
  'assets/img/logo-icon.png',
  'assets/img/favicon.svg',
  'assets/img/hero-banner-1.jpg',
  'assets/img/hero-banner-2.jpg',
  'assets/img/cta-robot.jpg',
  'assets/img/about-jizhi.jpg',
  'assets/img/supply-demand.jpg',
  'assets/img/course-ecom.jpg',
  'assets/img/course-aigc.jpg',
  'assets/img/course-comic.jpg',
  'assets/img/course-data.jpg',
  'assets/img/growth-class-1.jpg',
  'assets/img/growth-class-2.jpg',
  'assets/img/health-base.jpg',
  'assets/img/health-blood.jpg',
  'assets/img/health-center.jpg',
  'assets/img/health-family.jpg',
  'assets/img/health-food.jpg',
  'assets/img/health-sleep.jpg',
  'assets/img/health-sport.jpg',
  'assets/img/health-water.jpg',
  'assets/img/news-wuzhen-opc.jpg',
  'assets/img/news-ft-tech.jpg',
  'assets/img/news-shuzhi-fengtai.jpg',
  'assets/img/news-chuangke.jpg',
  'assets/img/news-suanli.jpg',
];

const shareCode =
  process.argv
    .slice(2)
    .map((arg) => arg.match(/^--sharecode=(.*)$/)?.[1])
    .find(Boolean) ?? process.env.OPC_REFERENCE_SHARE_CODE?.trim();
if (!shareCode) throw new Error('请设置 OPC_REFERENCE_SHARE_CODE 或 --sharecode 参数');

/** 编辑器（站方搭建工具）注入的节点属性：复刻产物里没有意义，全部剥离。 */
const NODE_ATTRS = [
  /\sdata-page-node-id="[^"]*"/g,
  /\sdata-sp-bindable="[^"]*"/g,
  /\sdata-sp-magnet="[^"]*"/g,
];

function stripEditorArtifacts(html) {
  let out = html;
  for (const pattern of NODE_ATTRS) out = out.replace(pattern, '');
  // 剥离编辑器样式块（站方搭建工具的调试样式，不属于站点视觉）
  out = out.replace(/<style id="__dm_[^"]*"[\s\S]*?<\/style>/g, '');
  return out;
}

async function fetchText(path) {
  const url = `${BASE}/${path}?sharecode=${encodeURIComponent(shareCode)}`;
  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) jizhi-opc-reference-fetch' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${path}`);
  return response.text();
}

async function fetchBinary(path) {
  const url = `${BASE}/${path}?sharecode=${encodeURIComponent(shareCode)}`;
  const response = await fetch(url, {
    headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) jizhi-opc-reference-fetch' },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} — ${path}`);
  return Buffer.from(await response.arrayBuffer());
}

async function main() {
  const pagesDir = join(repoRoot, 'scripts/opc-reference/pages');
  const assetsDir = join(repoRoot, 'scripts/opc-reference/assets');
  mkdirSync(pagesDir, { recursive: true });

  for (const name of PAGES) {
    const html = stripEditorArtifacts(await fetchText(PAGE_PATHS[name]));
    writeFileSync(join(pagesDir, `${name}.html`), html, 'utf8');
    console.log(`[page] ${name}.html ${html.length}B`);
  }

  for (const asset of ASSETS) {
    const target = join(repoRoot, 'scripts/opc-reference', asset);
    mkdirSync(dirname(target), { recursive: true });
    const binary = await fetchBinary(asset);
    writeFileSync(target, binary);
    console.log(`[asset] ${asset} ${binary.length}B`);
  }

  console.log(`\n完成：${PAGES.length} 个页面 + ${ASSETS.length} 个资源 → scripts/opc-reference/`);
}

main().catch((error) => {
  console.error('抓取失败：', error.message);
  process.exitCode = 1;
});
