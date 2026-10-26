import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * OPC 复刻站设计体系契约测试。
 *
 * 这套设计层（`src/styles/opc-tokens.css` + `opc-components.css`）是手写的，
 * 而底层 `public/opc/reference-blue.css` 是**机器生成的产物**
 * （`pnpm opc:styles` 会重跑并覆盖它）。
 *
 * 因此这里把设计体系的关键契约固化成测试：
 * 1. token 必须在，且值来自 `logo.svg` 实测色板（不得臆造新色）；
 * 2. 字号 / 间距 / 圆角必须收敛到有限档位（否则视觉层级会重新碎裂）；
 * 3. 组件层必须用双层 `.opc-replica.opc-replica` 提权
 *    —— 否则原站 `data-v-*` 规则会按加载顺序反向压过设计层。
 */

const tokens = readFileSync('src/styles/opc-tokens.css', 'utf8');
const components = readFileSync('src/styles/opc-components.css', 'utf8');

test('design tokens declare the full colour, type, spacing and radius scale', () => {
  const required = [
    '--opc-blue', '--opc-blue-deep', '--opc-blue-dark', '--opc-navy',
    '--opc-cyan', '--opc-teal',
    '--opc-ink', '--opc-ink-2', '--opc-ink-3', '--opc-ink-muted',
    '--opc-surface', '--opc-surface-2', '--opc-surface-blue',
    '--opc-line', '--opc-line-strong',
    '--opc-font-sans', '--opc-font-mono',
    '--opc-fs-display', '--opc-fs-h1', '--opc-fs-h2', '--opc-fs-h3',
    '--opc-fs-body', '--opc-fs-sm', '--opc-fs-xs', '--opc-fs-num',
    '--opc-space-1', '--opc-space-2', '--opc-space-3', '--opc-space-4',
    '--opc-space-6', '--opc-space-8', '--opc-space-12', '--opc-space-16',
    '--opc-radius-tag', '--opc-radius-control', '--opc-radius-panel', '--opc-radius-card',
  ];
  for (const name of required) {
    assert.ok(tokens.includes(`${name}:`), `missing token ${name}`);
  }
});

test('brand colours come from the measured logo palette and introduce no new hues', () => {
  // 与 test/brand-palette.test.ts 的既有约束保持一致：
  // 品牌色板 ∪ 中性阶梯 ∪ 语义色。不得臆造新色。
  // 本测试的价值在于**覆盖 opc-tokens.css**——
  // 既有的色板守卫只扫 Tailwind 任意值与 globals.css 的 --color-brand* token，
  // 不会检查本轮新增的 --opc-* token 文件。
  const BRAND = new Set([
    '1d7fba', '142f59', '152e56', '172d56', '0e3769',
    '57b6a5', '57b6a6', '1aa8d3', '1fabbe',
    '0968ab', '64c4d9', '4d5153',
  ]);
  const NEUTRAL = new Set(['1a2333', '4d5153', '5f6878', 'e3e9f2', 'eef4fa', 'f6f9fc', 'ffffff']);
  const SEMANTIC = new Set(['b42318']);
  const ALLOWED = new Set([...BRAND, ...NEUTRAL, ...SEMANTIC]);

  const hexes = [...tokens.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0].slice(1).toLowerCase());
  assert.ok(hexes.length > 0, 'no colours found in the token file');
  for (const hex of hexes) {
    // 允许 alpha 变体（#rrggbbaa）
    const base = hex.slice(0, 6);
    assert.ok(ALLOWED.has(base) || ALLOWED.has(hex), `undeclared colour #${hex}`);
  }
});

test('every text colour token meets WCAG AA on the surfaces it is used on', () => {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const ratio = (a: string, b: string) => {
    const [l1, l2] = [luminance(a), luminance(b)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const value = (name: string) => {
    const match = tokens.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'));
    assert.ok(match, `missing ${name}`);
    return match[1].toLowerCase();
  };
  // 浅底上承载正文的四级文字，全部需 ≥ 4.5:1（WCAG AA）
  for (const name of ['--opc-ink', '--opc-ink-2', '--opc-ink-3', '--opc-ink-muted']) {
    const colour = value(name);
    const onWhite = ratio(colour, '#ffffff');
    const onSurface = ratio(colour, value('--opc-surface'));
    assert.ok(onWhite >= 4.5, `${name} on white is ${onWhite.toFixed(2)}:1`);
    assert.ok(onSurface >= 4.5, `${name} on surface is ${onSurface.toFixed(2)}:1`);
  }
  // 品牌蓝：浅底小字用 --opc-blue-deep（≥4.5:1），主蓝只用于大字/边框
  assert.ok(ratio(value('--opc-blue-deep'), '#ffffff') >= 4.5);
  // 白字承载的品牌底
  assert.ok(ratio('#ffffff', value('--opc-blue-deep')) >= 4.5);
});

test('type scale stays within the declared number of steps', () => {
  const sizes = [...tokens.matchAll(/--opc-fs-[a-z0-9]+:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length <= 10, `too many font-size steps: ${sizes.length}`);
  assert.ok(sizes.length >= 8, 'font-size scale is too coarse');
  // 正文与标题两族各自单调：标题档递减、正文档递减，
  // 两族之间允许交错（数字档 34px 用于指标数字，与标题族独立）。
  const headings = sizes.filter((s) => s >= 19).sort((a, b) => b - a);
  const bodies = sizes.filter((s) => s < 19).sort((a, b) => b - a);
  for (const family of [headings, bodies]) {
    assert.ok(new Set(family).size === family.length, 'duplicate font-size steps');
  }
  assert.ok(headings.length >= 4, 'heading scale is too coarse');
  assert.ok(bodies.length >= 3, 'body scale is too coarse');
});

test('spacing and radius scales stay small', () => {
  const spaces = [...tokens.matchAll(/--opc-space-\d+:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(spaces.length <= 8, `too many spacing steps: ${spaces.length}`);
  const radii = [...tokens.matchAll(/--opc-radius-[a-z]+:\s*(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(radii.length <= 4, `too many radius steps: ${radii.length}`);
  assert.ok(radii.every((r) => r <= 16), 'radius exceeds the 16px ceiling');
});

test('component layer raises specificity so it wins over the generated reference CSS', () => {
  // 双层写法把特异性抬到 (0,3,0)，压过原站的 data-v-* 限定规则。
  // 单层写法会被原站按加载顺序反向压过 —— 实测已发生。
  const single = components.match(/^\.opc-replica (?![\w-]*opc-replica)/gm);
  assert.equal(single, null, `component layer still has single-level selectors: ${single?.length ?? 0}`);
  assert.ok(components.includes('.opc-replica.opc-replica'), 'no raised-specificity selector found');
});

test('no component style declares a font size below the 12px floor', () => {
  // 11px 是复现态遗留的最小字号档，实测被响应式审计抓出（交易市场 .sc-tag）。
  // 12px 是中文界面的可读下限。
  const offenders: string[] = [];
  for (const match of components.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
    if (Number(match[1]) < 12) offenders.push(match[0]);
  }
  assert.deepEqual(offenders, [], `component layer declares sub-12px font sizes: ${offenders.join(', ')}`);
});

test('token layer keeps variable declarations on the single-level root selector', () => {
  // 变量靠继承传递；写成双层会要求根元素同时有两个类，过于脆弱。
  // 但排版规则必须提权。这里只校验「变量块单层、规则块双层」这一约定存在。
  const variableBlock = tokens.match(/\.opc-replica \{[\s\S]*?--opc-blue:/);
  assert.ok(variableBlock, 'token variables must be declared on .opc-replica');
  assert.ok(tokens.includes('.opc-replica.opc-replica h1'), 'heading rules must raise specificity');
});

test('focus ring and reduced motion are preserved for keyboard and motion users', () => {
  // 焦点环定义在 token 层（设计 token 的归属），组件层与交互层复用它。
  assert.ok(tokens.includes(':focus-visible'), 'focus-visible styling is missing in tokens');
  assert.ok(tokens.includes('--opc-focus'), 'focus colour token is missing');
  // 减弱动效由 globals.css 统一处理，组件层不得覆盖掉它
  assert.ok(!components.includes('animation-duration'), 'component layer must not override reduced-motion');
});

test('every class the design layer targets actually exists in the replica DOM', () => {
  // ⚠️ 这一条是为了防「死规则」。
  //
  // 设计层写错一个类名，那一整段样式就**静默失效** ——
  // 不报错、不报警、测试全绿，只是从来没生效过。
  // 实测踩过两次：
  //   1. 页脚整段写成 `.footer` / `.opcfooter`，而复刻 DOM 真实容器是
  //      `.opcbottom` —— 页脚底色还是原站紫黑，链接字号还是 14px；
  //   2. 「记住我 / 忘记密码」写成 `.login-options` / `.form-options`，
  //      真实类名是 `.form-actions`。
  //
  // 所以这里把设计层引用的每个类名与生成产物的真实类名对账。
  // 只有「运行期由 JS 注入 / React 渲染」的类名可以豁免（见下方白名单）。
  const interactions = readFileSync('src/styles/opc-interactions.css', 'utf8');
  const css = [tokens, components, interactions].join('\n');

  // 注释里的类名不算（注释不参与渲染）
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, ' ');

  // 只取选择器部分，并去掉属性选择器与伪类
  const selectors: string[] = [];
  for (const match of noComments.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    selectors.push(match[1]);
  }
  const cleaned = selectors
    .join(' , ')
    .replace(/\[[^\]]*\]/g, ' ')        // [data-v-*] / [class*="bg-"] / [style*=...]
    .replace(/::?[a-z-]+(\([^()]*\))?/gi, ' '); // :hover / :not(...) / :where(...)

  const referenced = new Set<string>();
  for (const match of cleaned.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) referenced.add(match[1]);

  // 复刻 DOM 里真实存在的类名
  const domClasses = new Set<string>();
  // list-cards：P1 动态内容契约（docs/14）后 /newslist、/activitylist 的卡片快照，
  // 页面运行时注入的兜底串与原烘焙卡逐字节一致 —— 类名守卫需把它纳入 DOM 来源。
  for (const file of ['pages', 'details', 'article-shell', 'zone-cities', 'directory', 'listings', 'list-cards']) {
    const raw = readFileSync(`src/lib/opc/generated/${file}.json`, 'utf8');
    for (const match of raw.matchAll(/class=\\?"([^"\\]*)\\?"/g)) {
      for (const name of match[1].split(/\s+/)) if (name) domClasses.add(name);
    }
  }

  /**
   * 豁免白名单 —— 每一条都要写清「这个类从哪来」。
   * 新增条目时必须同时说明来源，否则等于把守卫关掉。
   */
  const runtimeOnly = new Set([
    // ReplicaInteractions.tsx 在运行期注入的弹窗/校验/状态类
    'opc-dialog', 'opc-dialog-close', 'opc-dialog-content', 'opc-dialog-footer',
    'opc-dialog-header', 'opc-empty-results', 'opc-field-error', 'opc-form-error',
    'opc-form-status', 'opc-invalid', 'opc-live-status', 'opc-menu-open',
    // ReplicaInteractions.tsx 在运行期注入的首页主视觉轮播指示器
    'opc-carousel-dots', 'opc-carousel-dot',
    // 页头滚动时由 JS 加上的状态类
    'scrolled',
    // React 侧渲染的复刻根容器
    'opc-replica',
  ]);

  const dead = [...referenced]
    .filter((name) => !domClasses.has(name) && !runtimeOnly.has(name))
    .sort();

  assert.deepEqual(
    dead,
    [],
    `design layer targets classes that do not exist in the replica DOM (dead rules):\n  ${dead.join('\n  ')}`,
  );
});

/**
 * ── CSS 文本层守卫 ──────────────────────────────────────────────────────
 *
 * 背景：2026-10-22 发生过一次真实事故 —— 把一条单行闭合的 CSS 注释
 * （形如「斜杠 星号 … 星号 斜杠」）拆成多行说明时，中间几行掉出了注释块，
 * 被浏览器当成**非法选择器**，整条规则（含 left/right）被静默丢弃，
 * 表现为「设计层声明存在但计算值不符」。
 *
 * CSS 解析器不会报错：非法选择器只是被忽略，页面照常渲染。
 * 因此只能靠静态检查守住，规则有两条：
 *   1. 注释块结构必须完整（不嵌套、剥离后不残留注释终止符）；
 *   2. 剥离注释后，**选择器里不许出现中文/全角符号** ——
 *      中文只允许出现在注释里，一旦出现在选择器位置就说明注释被拆断了。
 */

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

const CSS_FILES = [
  'src/styles/opc-tokens.css',
  'src/styles/opc-components.css',
  'src/styles/opc-interactions.css',
];

test('design layer CSS keeps comment blocks intact and selectors free of stray prose', () => {
  for (const file of CSS_FILES) {
    const raw = readFileSync(file, 'utf8');
    const stripped = stripCssComments(raw);

    // ① 注释被拆断的痕迹：剥完还剩 `*/` 或 `/*`
    assert.ok(!stripped.includes('*/'), `${file}: stray "*/" left after stripping comments`);
    assert.ok(!stripped.includes('/*'), `${file}: stray "/*" left after stripping comments`);

    // ② 选择器里出现中文 / 全角标点 = 说明正文掉出了注释块
    //    （CSS 标识符不可能合法地包含中文）
    const selectors = [...stripped.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim());
    assert.ok(selectors.length > 0, `${file}: no rules parsed`);
    for (const selector of selectors) {
      assert.ok(
        !/[\u2E80-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/.test(selector),
        `${file}: selector contains CJK/full-width text (comment block was split):\n  ${selector.slice(0, 120)}`,
      );
    }
  }
});

test('absolutely positioned pseudo-elements never leave width to the cascade', () => {
  /**
   * 原站 `reference-blue.css` 写着
   *   .nav-links a.active[data-v-…]:after { width: 100% }
   * 设计层若只覆盖 left/right 而不覆盖 width，`width:100%` 会因属性级联存活；
   * 而绝对定位同时给 left + right + width 属于**过度约束**，
   * 浏览器会忽略 right（LTR），伪元素右缘溢出宿主元素 → 压到相邻导航项，
   * 并让 scrollWidth > clientWidth（被响应式审计判为「文本硬裁」）。
   *
   * 规则：凡声明了 position:absolute 且同时给 left/right 的伪元素，
   * 必须显式声明 width。
   */
  const raw = readFileSync('src/styles/opc-components.css', 'utf8');
  const stripped = stripCssComments(raw);
  const blocks = [...stripped.matchAll(/([^{}]*)\{([^{}]*)\}/g)];

  let checked = 0;
  for (const [, selector, body] of blocks) {
    if (!/::?(after|before)/.test(selector)) continue;
    if (!/position\s*:\s*absolute/.test(body)) continue;
    const hasLeft = /(?:^|;)\s*left\s*:/.test(body);
    const hasRight = /(?:^|;)\s*right\s*:/.test(body);
    if (!hasLeft || !hasRight) continue;
    assert.ok(
      /(?:^|;)\s*width\s*:/.test(body),
      `pseudo-element pins left+right but not width (over-constrained → right is ignored):\n  ${selector.trim().slice(0, 120)}`,
    );
    checked += 1;
  }
  assert.ok(checked > 0, 'no absolutely positioned pseudo-element found to check');
});

test('首页深底规则必须带 :not(.scrolled) 限定', () => {
  /**
   * 运行期（`ReplicaInteractions.tsx`）把 `scrolled` 加在 `<nav>` 上 ——
   * 与原站 `nav.is-home:not(.scrolled)` 的机制一致。
   *
   * 首页页头未滚动时是透明底 + 白字（浮在深色主视觉上），
   * 滚动后变成白底 —— 白字必须退出，否则**白字落在白底上**，
   * 导航项与 logo 同时不可读（2026-10-22 实测）。
   *
   * 漏掉 `:not(.scrolled)` 的选择器一律视为缺陷。
   */
  const raw = readFileSync('src/styles/opc-components.css', 'utf8');
  const stripped = stripCssComments(raw);
  const offenders = [...stripped.matchAll(/[^{}]*\.opcheader:has\(nav\.is-home\)(?!\:not)[^{}]*\{/g)]
    .map((m) => m[0].trim().slice(0, 130));
  assert.deepEqual(
    offenders,
    [],
    `首页深底规则缺少 :not(.scrolled) 限定（滚动后白字落在白底上）:\n  ${offenders.join('\n  ')}`,
  );
});

test('agent banner 搜索面板：width 覆盖必须连带解除 max-width 钳制，输入框保持透明填充层', () => {
  /**
   * 2026-10-26 实测的同源隐性缺陷固化：
   *
   * 原站基线给 `.hero-search` 留了 `max-width: 480px`（不带 !important）。
   * 刷新层只写 `width: min(580px,100%) !important` 时，CSS 的跨属性钳制
   * （used width = min(width, max-width)）会把 580px **静默压回 480px** ——
   * 不报错、审计看不见：`scripts/opc-style-conflict.mjs` 只对账
   * color / font-size / background-color / border-radius / font-weight
   * 五个属性，width 与 max-width 的博弈不在它的视野里。
   * 所以 width 与 max-width 必须**成对**覆盖，缺一即回归。
   *
   * 同一块里的第二条契约：banner 搜索输入框是「透明填充层」——
   * `opc-components.css` 六、表单控件给所有 input[type=text] 上了
   * !important 的 `padding: 10px 14px` + 自带描边/圆角（那条规则本身
   * 是对的，登录/注册等真表单靠它）。若不在刷新层把它中和掉，输入框会
   * ① 占位文字压住左侧放大镜图标（图标占 18+18=36px > 14px 内距）、
   * ② 正文钻进右侧 ↵ 徽章下（徽章占 12+28=40px > 14px 内距）、
   * ③ 在外层面板里再画一圈内框（框中框）、
   * ④ 44px 行内框顶在 52px 面板里垂直偏上。
   * 左右内距 48/52px 即为图标与徽章让位的最小值，不得缩小。
   */
  const raw = readFileSync('src/styles/opc-layout-refresh.css', 'utf8');

  const panel = raw.match(/\.agent-store \.hero-search \{[^}]*\}/);
  assert.ok(panel, 'refresh layer 缺少 .agent-store .hero-search 面板规则块');
  assert.ok(
    /width:\s*min\(580px,\s*100%\)\s*!important/.test(panel[0]),
    '面板 width 声明丢失',
  );
  assert.ok(
    /max-width:\s*min\(580px,\s*100%\)\s*!important/.test(panel[0]),
    'width 覆盖没有连带覆盖 max-width —— 会被原站遗留的 max-width:480px 静默钳回 480px',
  );

  const input = raw.match(/\.agent-store \.hero-search \.hero-search-input \{[^}]*\}/);
  assert.ok(input, 'refresh layer 缺少 .hero-search-input 中和规则块');
  assert.ok(
    /padding:\s*0 52px 0 48px\s*!important/.test(input[0]),
    '输入框左右内距（48/52px 图标与 ↵ 徽章让位值）被改动',
  );
  assert.ok(
    /border:\s*0\s*!important/.test(input[0]),
    '输入框自带描边会在面板里形成框中框',
  );
});
