/**
 * 公开站样式契约测试。
 *
 * ── 2026-11-10 全站复刻后的样式架构 ─────────────────────────────────────
 *   公开站的视觉真源是**参考站样式**：
 *     - public/opc/reference/main.css      参考站样式原件，**编译期加了 .opc-site 作用域前缀**
 *                                        （见 scripts/build-opc-reference.mjs 的 scopeCss）
 *     - public/opc/reference/extension.css 我们自己的扩展样式（补齐参考站自身缺失的类
 *                                        + 后台动态区块样式 + 可达性修正）
 *   src/styles/globals.css               Tailwind + 品牌 token（后台 / 原生页用）
 *   src/styles/admin-rich-text.css       后台富文本排版基线
 *
 * 旧的「opc-*.css 设计层」（opc-tokens / opc-components / opc-layout-refresh /
 * opc-polish / opc-visual / opc-interactions / opc-visual-motion）与
 * public/opc/reference-blue.css 已全部删除 —— 它们是为 opcstore.com 的旧 DOM 写的，
 * 与参考站 DOM 的同名类（.hero / .cta / .btn / .form…）冲突。
 *
 * 删除的旧断言（逐条说明）：
 *   - 「opc-tokens.css 的 token 全集 / 色板 / WCAG 对比度 / 字号档位 / 间距圆角档位」
 *     → token 文件已删除；字号与色板的守卫改到 extension.css 与 src/styles/** 上；
 *   - 「组件层用双层 .opc-replica.opc-replica 提权压过参考 CSS」
 *     → 旧设计层已下线，参考站样式靠 .opc-site 作用域隔离（而不是提权）；
 *   - 「opc-components.css 里每个类名都要在复刻 DOM 里存在」
 *     → 旧设计层文件已删除；现在守卫的是 extension.css 引用的类；
 *   - 「首页深底规则必须带 :not(.scrolled)」「agent banner 搜索面板 width/max-width 配对」
 *     → 旧 DOM（.opcheader / .agent-store / .hero-search）已不存在；
 *   - 「CSS 注释块完整 / 选择器无中文」→ 改到 extension.css 上继续守。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');

const MAIN_CSS = 'public/opc/reference/main.css';
const EXTENSION_CSS = 'public/opc/reference/extension.css';

/** 剥掉 @keyframes 块（其内部是百分比，不是选择器）。 */
function stripKeyframes(css: string): string {
  let out = '';
  let index = 0;
  while (index < css.length) {
    const at = css.indexOf('@keyframes', index);
    const atWebkit = css.indexOf('@-webkit-keyframes', index);
    const start = at < 0 ? atWebkit : atWebkit < 0 ? at : Math.min(at, atWebkit);
    if (start < 0) {
      out += css.slice(index);
      break;
    }
    out += css.slice(index, start);
    const braceAt = css.indexOf('{', start);
    if (braceAt < 0) {
      out += css.slice(start);
      break;
    }
    let depth = 0;
    let cursor = braceAt;
    for (; cursor < css.length; cursor += 1) {
      if (css[cursor] === '{') depth += 1;
      else if (css[cursor] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    index = cursor + 1;
  }
  return out;
}

/** 正确剥离 CSS 注释：逐字符扫描，跳过字符串字面量，不处理注释嵌套。 */
function stripCssComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      out += ch;
      i += 1;
      while (i < src.length) {
        out += src[i];
        if (src[i] === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
        if (src[i] === quote) { i += 1; break; }
        i += 1;
      }
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      assert.notEqual(end, -1, 'unterminated CSS comment');
      out += ' ';
      i = end + 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** 取出所有规则的「选择器部分 + 声明块」。 */
function rulesOf(css: string): Array<{ selector: string; body: string }> {
  const stripped = stripKeyframes(stripCssComments(css));
  const rules: Array<{ selector: string; body: string }> = [];
  for (const match of stripped.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const trimmed = part.trim();
      if (trimmed) rules.push({ selector: trimmed, body: match[2] });
    }
  }
  return rules;
}

/** 只取选择器部分。 */
function selectorsOf(css: string): string[] {
  return rulesOf(css).map((rule) => rule.selector);
}

/** 从 HTML / TSX 源码里收集真实存在的类名。 */
function classTokens(source: string): string[] {
  const tokens: string[] = [];
  const pattern = /class(?:Name)?\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|\{\s*`([^`]*)`\s*\})/g;
  for (const match of source.matchAll(pattern)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
    // 模板字面量只取静态前缀（`mnav${open ? ' on' : ''}` → mnav）
    const literal = raw.split('${')[0];
    for (const token of literal.split(/[\s"'`]+/)) if (token) tokens.push(token);
  }
  // 运行期状态类同样属于真实 DOM，例如 classList.toggle('is-error', failed)。
  const dynamicPattern = /classList\.(?:add|remove|toggle)\(\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(dynamicPattern)) tokens.push(match[1]);
  return tokens;
}

const pages = JSON.parse(read('src/lib/opc/generated/pages.json')) as Record<string, { html: string }>;
const articleShell = JSON.parse(read('src/lib/opc/generated/article-shell.json')) as { html: string };

/**
 * 站内真实存在的类名来源：
 *   1. 烘焙产物（参考站快照正文 + 文章外壳）；
 *   2. React 外壳（Header / Footer / SiteChrome）；
 *   3. 运行期区块渲染器（blocks-runtime / news-runtime）与交互组件。
 * 三者合起来就是**前台 DOM 能出现的全部类名**。
 */
function domClasses(): Set<string> {
  const classes = new Set<string>();
  for (const page of Object.values(pages)) for (const token of classTokens(page.html)) classes.add(token);
  for (const token of classTokens(articleShell.html)) classes.add(token);
  for (const file of [
    'src/components/layout/Header.tsx',
    'src/components/layout/Footer.tsx',
    'src/components/layout/SiteChrome.tsx',
    'src/lib/opc/blocks-runtime.ts',
    'src/lib/opc/news-runtime.ts',
    'src/lib/opc/hero-carousel.ts',
    'src/components/opc/ReferenceInteractions.tsx',
  ]) {
    for (const token of classTokens(read(file))) classes.add(token);
  }
  return classes;
}

test('参考站样式原件存在，且所有选择器都被 .opc-site 限定', () => {
  assert.ok(existsSync(resolve(repoRoot, MAIN_CSS)), '缺少参考站样式原件');
  const css = read(MAIN_CSS);
  const selectors = selectorsOf(css);
  assert.ok(selectors.length > 100, `参考站样式规则过少：${selectors.length}`);
  const unscoped = selectors.filter((selector) => !selector.startsWith('.opc-site'));
  // 只允许 html 级规则例外（scroll-behavior / scroll-padding-top 与作用域无关）
  assert.deepEqual(
    unscoped.sort(),
    ['html'],
    `参考站样式里有脱离 .opc-site 作用域的选择器：${unscoped.join(' | ')}`,
  );
});

test('参考站样式不得出现裸的全局重置（body / h1 / p / ul 等）', () => {
  const css = read(MAIN_CSS);
  const bare: string[] = [];
  for (const selector of selectorsOf(css)) {
    if (selector.startsWith('.opc-site')) continue;
    const head = selector.split(/[\s>+~,]/)[0];
    if (['body', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'li', 'img', 'button', 'a', 'input', 'table'].includes(head)) {
      bare.push(selector);
    }
  }
  assert.deepEqual(bare, [], `参考站样式里的裸全局重置：${bare.join(' | ')}`);
});

test('参考站样式变量定义在作用域根（:root → .opc-site）', () => {
  const css = read(MAIN_CSS);
  assert.match(css, /\.opc-site\s*\{[^}]*--navy/, '作用域根上应有 --navy 等 token');
  assert.doesNotMatch(css, /(^|[,}\s]):root\s*\{/m, '不应残留未作用域化的 :root');
});

test('扩展样式里的类名在站内 DOM 里真实存在（防死规则）', () => {
  assert.ok(existsSync(resolve(repoRoot, EXTENSION_CSS)), '缺少扩展样式');
  const css = read(EXTENSION_CSS);
  const classes = domClasses();
  const referenced = new Set<string>();
  for (const selector of selectorsOf(css)) {
    const cleaned = selector.replace(/\[[^\]]*\]/g, ' ').replace(/::?[a-z-]+(\([^()]*\))?/gi, ' ');
    for (const match of cleaned.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) referenced.add(match[1]);
  }
  referenced.delete('opc-site');
  const dead = [...referenced].filter((name) => !classes.has(name)).sort();
  assert.deepEqual(
    dead,
    [],
    `扩展样式指向了站内不存在的类（死规则）：\n  ${dead.join('\n  ')}`,
  );
  assert.ok(referenced.size > 20, `扩展样式引用的类过少：${referenced.size}`);
});

test('扩展样式补齐了参考站自身缺失的类（课程卡 / 就业流程 / 入驻页 / 新闻配图）', () => {
  const css = read(EXTENSION_CSS);
  for (const name of [
    'ac-crs', 'ac-crs__i', 'ac-flow', 'ac-fl', 'gw-band', 'gw-tb',
    'jblk', 'jben', 'jfl', 'jreq', 'nfig', 'nnotice', 'nsrc', 'ab-cap', 'chev',
    'partner-wall', 'totop',
  ]) {
    assert.ok(css.includes(`.${name}`), `扩展样式缺少 .${name}`);
  }
});

test('我们自己写的样式里没有小于 12px 的 font-size', () => {
  const files = [
    ...readdirSync(resolve(repoRoot, 'src/styles')).map((name) => `src/styles/${name}`),
    EXTENSION_CSS,
  ];
  const offenders: string[] = [];
  for (const file of files) {
    const css = read(file);
    for (const match of css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
      if (Number(match[1]) < 12) offenders.push(`${file} → ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], `自有样式声明了小于 12px 的字号：\n  ${offenders.join('\n  ')}`);
});

test('交互控件自身的触控区不小于 24px', () => {
  const css = read(EXTENSION_CSS);
  const rules = rulesOf(css);
  // 我们在扩展样式里自己写的交互控件
  const controls = ['totop', 'needchip', 'agree-check'];
  for (const control of controls) {
    const own = rules.find((rule) => rule.selector.endsWith(`.${control}`));
    assert.ok(own, `扩展样式缺少 .${control} 的规则`);
    const box = /(?:^|;)\s*(?:min-)?(?:width|height)\s*:\s*(\d+(?:\.\d+)?)px/.exec(own!.body);
    assert.ok(box, `.${control} 必须显式声明触控尺寸`);
    assert.ok(Number(box![1]) >= 24, `.${control} 的触控区只有 ${box![1]}px`);
  }
});

test('小于 24px 的尺寸只落在控件内部的装饰元素上，不落在控件本体', () => {
  const css = read(EXTENSION_CSS);
  const controls = new Set(['totop', 'needchip', 'agree-check', 'btn', 'chip', 'button', 'a']);
  const offenders: string[] = [];
  for (const rule of rulesOf(css)) {
    for (const match of rule.body.matchAll(/(?:^|;)\s*(?:width|height)\s*:\s*(\d+(?:\.\d+)?)px/g)) {
      if (Number(match[1]) >= 24) continue;
      // 允许的：小图标 / 勾选框指示器（它们被包在 ≥24px 的控件里）
      const tail = rule.selector.split(/[\s>+~,]/).pop() ?? '';
      const isDecoration = /^(svg|input|i|em|b|span|\.chev)$/.test(tail);
      if (isDecoration) continue;
      const own = controls.has(tail.replace(/^\./, ''));
      if (own) offenders.push(`${rule.selector} → ${match[0].trim()}`);
    }
  }
  assert.deepEqual(offenders, [], `交互控件本体被声明为小于 24px：\n  ${offenders.join('\n  ')}`);
});

test('焦点可见：参考站与自有样式都有 :focus-visible 兜底', () => {
  assert.ok(read(MAIN_CSS).includes(':focus-visible'), '参考站样式缺少 :focus-visible');
  assert.ok(read('src/styles/globals.css').includes(':focus-visible'), 'globals.css 缺少 :focus-visible');
});

test('减弱动效：参考站与自有样式都有 prefers-reduced-motion 兜底', () => {
  const main = read(MAIN_CSS);
  assert.ok(main.includes('prefers-reduced-motion'), '参考站样式缺少 prefers-reduced-motion');
  // 参考站的进场动效在减弱动效下必须直接可见（.rv 复位）
  const block = /@media\s*\(prefers-reduced-motion:reduce\)\s*\{([^}]*)\}/.exec(main)?.[1] ?? '';
  assert.match(main, /\.opc-site \.rv\{opacity:1;transform:none\}/, '减弱动效下 .rv 必须直接可见');
  assert.ok(read('src/styles/globals.css').includes('prefers-reduced-motion'), 'globals.css 缺少 prefers-reduced-motion');
});

test('滚动进场约定 .rv → .vis 在参考站样式里成立', () => {
  const css = read(MAIN_CSS);
  assert.match(css, /\.opc-site \.rv\{opacity:0/, '.rv 初始应透明');
  assert.match(css, /\.opc-site \.rv\.vis\{opacity:1;transform:none\}/, '.vis 应复位');
});

test('CSS 注释块完整，选择器里不出现中文 / 全角标点', () => {
  for (const file of [MAIN_CSS, EXTENSION_CSS, 'src/styles/globals.css', 'src/styles/admin-rich-text.css']) {
    const raw = read(file);
    const stripped = stripCssComments(raw);
    assert.ok(!stripped.includes('*/'), `${file}: 剥完注释还剩 "*/"`);
    assert.ok(!stripped.includes('/*'), `${file}: 剥完注释还剩 "/*"`);
    for (const selector of selectorsOf(raw)) {
      assert.ok(
        !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(selector),
        `${file}: 选择器含中文 / 全角字符（注释块可能被拆断）：\n  ${selector.slice(0, 120)}`,
      );
    }
  }
});

test('旧设计层文件已彻底下线（不再与参考站同名类冲突）', () => {
  for (const file of [
    'src/styles/opc-components.css',
    'src/styles/opc-interactions.css',
    'src/styles/opc-layout-refresh.css',
    'src/styles/opc-polish.css',
    'src/styles/opc-tokens.css',
    'src/styles/opc-visual-motion.css',
    'src/styles/opc-visual.css',
    'public/opc/reference-blue.css',
  ]) {
    assert.equal(existsSync(resolve(repoRoot, file)), false, `${file} 应已删除`);
  }
  // src/styles/ 现在只剩 globals.css 与 admin-rich-text.css
  assert.deepEqual(readdirSync(resolve(repoRoot, 'src/styles')).sort(), ['admin-rich-text.css', 'globals.css']);
});

test('参考站样式与扩展样式都被根布局引入，且作用域根是 .opc-site', () => {
  const layout = read('src/app/layout.tsx');
  assert.ok(layout.includes('/opc/reference/main.css'), '根布局必须引入参考站样式');
  assert.ok(layout.includes('/opc/reference/extension.css'), '根布局必须引入扩展样式');
  const chrome = read('src/components/layout/SiteChrome.tsx');
  assert.ok(chrome.includes('className="opc-site"'), '公开站外壳根节点必须是 .opc-site');
  assert.ok(chrome.includes('className="opc-independent"'), '后台/运营区必须是 .opc-independent');
});
