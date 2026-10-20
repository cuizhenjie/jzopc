#!/usr/bin/env node
/**
 * 工程校验脚本（零依赖，Node ≥ 20）。
 *
 * 目的：把「文档 / package.json 承诺了不存在的文件」这类交付缺口变成可复跑的检查项。
 * 每项输出 [OK] / [FAIL] / [SKIP]，末尾给汇总；存在 FAIL 时退出码为 1。
 *
 * 用法：
 *   node scripts/verify.mjs          # 人读格式
 *   node scripts/verify.mjs --json   # 机器可读（便于接 CI）
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.slice(2).includes('--json');

/* ── 通用工具 ──────────────────────────────────────────────────────────── */

const rel = (p) => relative(repoRoot, p).split('\\').join('/');

/** 读取仓库内文件；不存在返回 null（不抛异常，避免脚本整体崩掉） */
function readRepoFile(relPath) {
  const abs = join(repoRoot, relPath);
  if (!existsSync(abs)) return null;
  try {
    return readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

/** 递归收集文件相对路径，跳过依赖与构建产物目录 */
const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', '.screenshots', '.umadev',
  'dist', 'out', 'build', '.vercel', 'coverage', '.turbo',
]);

function walkRepoFiles(dir = repoRoot, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') {
      if (SKIP_DIRS.has(entry.name)) continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkRepoFiles(full, out);
    } else if (entry.isFile()) {
      out.push(rel(full));
    }
  }
  return out;
}

const repoFiles = walkRepoFiles();
const repoBasenames = new Set(repoFiles.map((p) => p.split('/').pop()));

/* ── Markdown 表格解析 ─────────────────────────────────────────────────── */

/** 按未转义的 `|` 切分单元格（`\|` 不算分隔符） */
function splitTableRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim());
}

/** 是否是表格行：至少两个未转义竖线，且首个竖线前没有正文 */
function isTableRow(line) {
  const t = line.trim();
  if (!t.includes('|')) return false;
  const barCount = t.split(/(?<!\\)\|/).length - 1;
  if (barCount < 2) return false;
  const firstBar = t.indexOf('|');
  return firstBar === 0 || t.slice(0, firstBar).trim() === '';
}

/** 是否是表格分隔行（`|---|---|`） */
function isSeparatorRow(line) {
  if (!isTableRow(line)) return false;
  const cells = splitTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((c) => /^:?-{2,}:?$/.test(c.trim()));
}

/** 扫描一个文档里的所有表格，返回 [{ headerLine, headerCols, rows: [{line, cols}] }] */
function parseTables(text) {
  const lines = text.split(/\r?\n/);
  const tables = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isSeparatorRow(lines[i])) continue;
    const headerIdx = i - 1;
    if (headerIdx < 0 || !isTableRow(lines[headerIdx])) continue;

    const headerCols = splitTableRow(lines[headerIdx]).length;
    const rows = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (!isTableRow(lines[j])) break;
      rows.push({ line: j + 1, cols: splitTableRow(lines[j]).length, cells: splitTableRow(lines[j]) });
    }
    tables.push({
      headerLine: headerIdx + 1,
      headerCols,
      separatorCols: splitTableRow(lines[i]).length,
      rows,
    });
  }
  return tables;
}

/** 反引号包裹的代码片段 */
function backticked(text) {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => ({ token: m[1], index: m.index }));
}

/** 取 token 所在行号（1 基） */
function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

/* ── 文档清单 ──────────────────────────────────────────────────────────── */

/** 需要扫描的文档：docs/*.md + findings.md + task_plan.md + README.md */
function collectDocPaths() {
  const docs = [];
  const docsDir = join(repoRoot, 'docs');
  if (existsSync(docsDir)) {
    for (const name of readdirSync(docsDir).sort()) {
      if (name.endsWith('.md')) docs.push(`docs/${name}`);
    }
  }
  for (const name of ['findings.md', 'task_plan.md', 'README.md']) {
    if (existsSync(join(repoRoot, name))) docs.push(name);
  }
  return docs;
}

const docPaths = collectDocPaths();
const docTexts = new Map(
  docPaths.map((p) => [p, readRepoFile(p)]).filter(([, t]) => t !== null),
);

/* ── 检查项 ────────────────────────────────────────────────────────────── */

/**
 * 检查 1：文档表格列数一致性。
 * 表头列数必须与每个数据行（含分隔行）一致。
 */
function checkTableColumns() {
  const issues = [];
  let tableCount = 0;
  for (const [path, text] of docTexts) {
    for (const table of parseTables(text)) {
      tableCount++;
      if (table.separatorCols !== table.headerCols) {
        issues.push({
          file: path,
          line: table.headerLine + 1,
          message: `分隔行 ${table.separatorCols} 列，表头 ${table.headerCols} 列`,
        });
      }
      for (const row of table.rows) {
        if (row.cols !== table.headerCols) {
          issues.push({
            file: path,
            line: row.line,
            message: `数据行 ${row.cols} 列，表头 ${table.headerCols} 列`,
          });
        }
      }
    }
  }
  return {
    status: issues.length === 0 ? 'OK' : 'FAIL',
    summary: `扫描 ${docTexts.size} 个文档 / ${tableCount} 张表格，${issues.length} 处列数不一致`,
    details: issues.map((i) => `${i.file}:${i.line} ${i.message}`),
  };
}

/**
 * 检查 2：FR 编号完整性。
 * 定义 = docs/01-需求文档.md 表格首列；引用 = 技术方案 + 开发计划。
 */
function checkFrIntegrity() {
  const defDoc = 'docs/01-需求文档.md';
  const FR_DEF = /^FR-[A-Z0-9]+-\d+$/;
  const FR_TOKEN = /FR-[A-Z0-9]+-\d+/g;

  const defined = new Set();
  const defText = docTexts.get(defDoc);
  if (defText) {
    for (const table of parseTables(defText)) {
      for (const row of table.rows) {
        const first = (row.cells[0] ?? '').trim();
        if (FR_DEF.test(first)) defined.add(first);
      }
    }
  } else {
    return { status: 'SKIP', summary: `未找到 ${defDoc}，跳过 FR 编号检查`, details: [] };
  }

  const referenced = new Map(); // fr -> Set(引用它的文档)
  for (const path of ['docs/02-技术方案.md', 'docs/03-开发计划.md']) {
    const text = docTexts.get(path);
    if (!text) continue;
    for (const m of text.matchAll(FR_TOKEN)) {
      if (!referenced.has(m[0])) referenced.set(m[0], new Set());
      referenced.get(m[0]).add(path);
    }
  }

  const dangling = [...referenced.keys()].filter((fr) => !defined.has(fr)).sort();

  const details = [];
  for (const fr of dangling) {
    details.push(`悬空引用 ${fr}（引用方：${[...referenced.get(fr)].join(', ')}）`);
  }

  return {
    status: dangling.length === 0 ? 'OK' : 'FAIL',
    summary: `定义 ${defined.size} 条 FR，被引用 ${referenced.size} 条，悬空引用 ${dangling.length} 条`,
    details,
  };
}

/**
 * 检查 3：文档内文件路径引用有效性。
 * 反引号包裹的代码文件路径，按 basename 在全仓库匹配；找不到同名文件才算悬空。
 */
function checkDocFileReferences() {
  const ALLOWED_EXT = new Set([
    'ts', 'tsx', 'mjs', 'cjs', 'js', 'sql', 'css', 'md', 'json', 'yml', 'yaml', 'svg',
  ]);
  /** 无常规扩展名但同样需要存在的文件 */
  const EXTRA_NAMES = new Set(['.env.example']);

  const dangling = [];
  const checked = new Set();
  const seen = new Set();

  for (const [path, text] of docTexts) {
    for (const { token, index } of backticked(text)) {
      if (token.includes('*') || token.includes('…')) continue;      // 通配写法
      if (/\s/.test(token)) continue;                                   // 含空白
      if (/[<>{}()=;,"'`]/.test(token)) continue;                        // 不是路径
      if (token.includes('://')) continue;                               // URL
      if (token.startsWith('/') || token.startsWith('~') || token.startsWith('.')) {
        if (!token.startsWith('./') && !token.startsWith('../') && !token.startsWith('.env')) continue;
      }

      const lastSegment = token.split('/').pop() ?? '';
      const dot = lastSegment.lastIndexOf('.');
      const ext = dot > 0 ? lastSegment.slice(dot + 1).toLowerCase() : '';
      const isExtra = EXTRA_NAMES.has(token) || EXTRA_NAMES.has(lastSegment);
      if (!isExtra && !ALLOWED_EXT.has(ext)) continue;

      checked.add(token);
      const line = lineOf(text, index);
      const key = `${path}:${line}:${token}`;
      if (seen.has(key)) continue; // 同一行同一 token 只报一次
      seen.add(key);

      // 省略号写法（如 `docs/05-...竞品事实.md`）：按前缀匹配
      if (token.includes('...')) {
        const prefix = token.slice(0, token.indexOf('...'));
        if (repoFiles.some((f) => f.includes(prefix))) continue;
        dangling.push({ file: path, line, token });
        continue;
      }

      if (repoBasenames.has(lastSegment)) continue;
      dangling.push({ file: path, line, token });
    }
  }

  return {
    status: dangling.length === 0 ? 'OK' : 'FAIL',
    summary: `检查 ${checked.size} 个文件路径引用，${dangling.length} 个悬空`,
    details: dangling.map((d) => `${d.file}:${d.line} 引用了不存在的文件 \`${d.token}\``),
  };
}

/**
 * 检查 4：package.json scripts 指向的文件是否存在。
 */
function checkPackageScripts() {
  const pkgText = readRepoFile('package.json');
  if (!pkgText) {
    return { status: 'SKIP', summary: '未找到 package.json，跳过', details: [] };
  }
  let pkg;
  try {
    pkg = JSON.parse(pkgText);
  } catch (e) {
    return { status: 'FAIL', summary: 'package.json 解析失败', details: [String(e)] };
  }

  const missing = [];
  let count = 0;
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    for (const token of String(command).split(/\s+/)) {
      if (!/\.(mjs|cjs|js|ts|tsx)$/i.test(token)) continue;
      if (token.includes('*')) continue; // glob
      count++;
      const abs = resolve(repoRoot, token);
      if (!existsSync(abs)) {
        missing.push(`scripts.${name} → \`${token}\` 不存在`);
      }
    }
  }

  return {
    status: missing.length === 0 ? 'OK' : 'FAIL',
    summary: `检查 ${count} 个 script 路径引用，${missing.length} 个缺失`,
    details: missing,
  };
}

/**
 * 检查 5：路由清单 vs 实际目录。
 */
function checkRouteManifest() {
  const appDir = join(repoRoot, 'src/app');
  if (!existsSync(appDir)) {
    return { status: 'SKIP', summary: '未找到 src/app/，跳过路由检查', details: [] };
  }

  const pageRoutes = [];
  const apiRoutes = [];
  (function collect(dir, prefix) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        const seg = entry.name.startsWith('(') && entry.name.endsWith(')') ? '' : entry.name;
        collect(full, `${prefix}/${seg}`);
      } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
        pageRoutes.push(prefix || '/');
      } else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
        apiRoutes.push(prefix || '/');
      }
    }
  })(appDir, '');

  const allRoutes = [...pageRoutes, ...apiRoutes];

  // 动态段匹配：实际路由里的 [slug] 能匹配任意具体段
  function matchSegments(actual, target) {
    if (actual.length === 0 || target.length === 0) return actual.length === target.length;
    const [head, ...rest] = actual;
    const [tHead, ...tRest] = target;
    if (head.startsWith('[[...') && head.endsWith(']]')) return true;
    if (head.startsWith('[...') && head.endsWith(']')) {
      if (rest.length === 0) return false;
      return tRest.length === 0 || matchSegments(rest, tRest);
    }
    if (head.startsWith('[') && head.endsWith(']')) return matchSegments(rest, tRest);
    return head === tHead && matchSegments(rest, tRest);
  }
  const routeMatches = (actual, target) =>
    matchSegments(actual.split('/').filter(Boolean), target.split('/').filter(Boolean));

  // 计划文档里声明的路由
  const planPath = 'docs/03-开发计划.md';
  const planText = docTexts.get(planPath);
  if (!planText) {
    return { status: 'SKIP', summary: `未找到 ${planPath}，跳过路由对照`, details: [] };
  }
  const declared = new Set();
  /** 绝对文件系统路径不是路由（文档里出现的临时目录等） */
  const SYSTEM_PATH_PREFIXES = [
    '/tmp/', '/var/', '/usr/', '/etc/', '/opt/', '/home/', '/root/',
    '/Users/', '/private/', '/proc/', '/dev/',
  ];
  for (const { token } of backticked(planText)) {
    if (!token.startsWith('/')) continue;
    if (token.includes('*') || token.includes('...')) continue;
    if (SYSTEM_PATH_PREFIXES.some((p) => token.startsWith(p))) continue;
    if (!/^\/[A-Za-z0-9\-_/]+(\[[A-Za-z0-9\-_]+\])?$/.test(token)) continue;
    declared.add(token);
  }

  const missing = [];
  const sectionRefs = [];
  for (const d of [...declared].sort()) {
    if (allRoutes.some((r) => routeMatches(r, d))) continue;
    // 是某个实际路由的父路径 → 视为区段引用而非缺失路由
    if (allRoutes.some((r) => r.startsWith(d + '/'))) {
      sectionRefs.push(`${d}（是实际路由 ${allRoutes.filter((r) => r.startsWith(d + '/')).join(', ')} 的区段前缀）`);
      continue;
    }
    missing.push(d);
  }

  const undeclared = allRoutes
    .filter((r) => !declared.has(r))
    .filter((r) => ![...declared].some((d) => routeMatches(r, d)))
    .sort();

  const details = [
    ...missing.map((m) => `计划声明了 \`${m}\`，但 src/app/ 下没有对应路由`),
    ...sectionRefs.map((s) => `区段引用（非缺失路由）：${s}`),
    `计划未声明的实际路由（${undeclared.length}）：${undeclared.join(', ')}`,
  ];

  return {
    status: missing.length === 0 ? 'OK' : 'FAIL',
    summary: `实际 ${allRoutes.length} 条路由（页面 ${pageRoutes.length} / API ${apiRoutes.length}），计划声明 ${declared.size} 条，缺失 ${missing.length} 条`,
    details,
  };
}

/**
 * 检查 6：品牌色 token 与 logo.svg 实测值一致性。
 */
function checkBrandTokens() {
  const css = readRepoFile('src/styles/globals.css');
  const logo = readRepoFile('logo.svg');
  if (!css || !logo) {
    return { status: 'SKIP', summary: '缺少 globals.css 或 logo.svg，跳过品牌色检查', details: [] };
  }

  const logoColors = new Set(
    [...logo.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()),
  );

  /** logo.svg 实测的 6 组基准色 → globals.css token */
  const CANONICAL = {
    '--color-brand-blue': '#1d7fba',      // 主蓝
    '--color-brand-navy': '#142f59',      // 深藏蓝
    '--color-brand-teal': '#57b6a5',      // 青绿
    '--color-brand-cyan': '#1aa8d3',      // 亮青
    '--color-gradient-from': '#0968ab',   // 渐变起点
    '--color-gradient-to': '#64c4d9',     // 渐变终点
    '--color-ink-2': '#4d5153',           // 中性灰
  };

  const cssTokens = new Map();
  for (const m of css.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    cssTokens.set(`--${m[1]}`, m[2].toLowerCase());
  }

  const details = [];
  let bad = 0;
  for (const [token, expected] of Object.entries(CANONICAL)) {
    const actual = cssTokens.get(token);
    if (actual === undefined) {
      bad++;
      details.push(`globals.css 缺少 token ${token}（期望 ${expected}）`);
    } else if (actual !== expected) {
      bad++;
      details.push(`${token} = ${actual}，与 logo.svg 实测值 ${expected} 不一致`);
    }
    if (!logoColors.has(expected)) {
      bad++;
      details.push(`${expected} 在 logo.svg 中不存在（基准值本身有误）`);
    }
  }

  // 反向检查：所有品牌色 token 的色值都必须在 logo.svg 里有出处
  // （品牌 token 动态识别，后续新增的 --color-brand-* 也会自动纳入检查）
  const BRAND_TOKENS = [
    ...new Set([
      ...[...cssTokens.keys()].filter((t) => /^--color-(brand|gradient)-/.test(t)),
      '--color-ink-2',
    ]),
  ].sort();
  for (const token of BRAND_TOKENS) {
    const hex = cssTokens.get(token);
    if (hex === undefined) {
      bad++;
      details.push(`globals.css 缺少品牌色 token ${token}`);
    } else if (!logoColors.has(hex)) {
      bad++;
      details.push(`${token} = ${hex}，在 logo.svg 中找不到出处（臆造色）`);
    }
  }

  return {
    status: bad === 0 ? 'OK' : 'FAIL',
    summary: `核对 ${Object.keys(CANONICAL).length} 个基准色 token + ${BRAND_TOKENS.length} 个品牌色 token，${bad} 处不一致`,
    details,
  };
}

/* ── 执行与输出 ────────────────────────────────────────────────────────── */

const CHECKS = [
  { id: 'doc-tables', title: '文档表格列数一致性', run: checkTableColumns },
  { id: 'fr-integrity', title: 'FR 编号完整性（定义 vs 悬空引用）', run: checkFrIntegrity },
  { id: 'doc-file-refs', title: '文档内文件路径引用有效性', run: checkDocFileReferences },
  { id: 'package-scripts', title: 'package.json scripts 指向的文件存在性', run: checkPackageScripts },
  { id: 'route-manifest', title: '路由清单 vs 实际目录', run: checkRouteManifest },
  { id: 'brand-tokens', title: '品牌色 token 与 logo.svg 一致性', run: checkBrandTokens },
];

const results = [];
for (const check of CHECKS) {
  let outcome;
  try {
    outcome = check.run();
  } catch (e) {
    outcome = { status: 'FAIL', summary: '检查项执行异常', details: [e?.stack ?? String(e)] };
  }
  results.push({ id: check.id, title: check.title, ...outcome });
}

const counts = { OK: 0, FAIL: 0, SKIP: 0 };
for (const r of results) counts[r.status] = (counts[r.status] ?? 0) + 1;
const ok = counts.FAIL === 0;

if (asJson) {
  console.log(
    JSON.stringify(
      { ok, summary: { total: results.length, ...counts }, checks: results },
      null,
      2,
    ),
  );
} else {
  const LABEL = { OK: '[OK]  ', FAIL: '[FAIL]', SKIP: '[SKIP]' };
  for (const r of results) {
    console.log(`${LABEL[r.status]} ${r.title}\n       ${r.summary}`);
    for (const d of r.details) {
      console.log(`       - ${d}`);
    }
  }
  console.log('─'.repeat(64));
  console.log(
    `汇总：${results.length} 项检查 · ${counts.OK} OK / ${counts.FAIL} FAIL / ${counts.SKIP} SKIP` +
      (ok ? ' · 全部通过' : ' · 存在 FAIL'),
  );
}

process.exit(ok ? 0 : 1);
