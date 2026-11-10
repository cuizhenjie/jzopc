#!/usr/bin/env node
/**
 * 编译「集智 AI OPC 社区」参考站快照 → 站点可消费的静态产物。
 *
 * 事实源：scripts/opc-reference/（由 scripts/fetch-opc-reference.mjs 抓取）
 * 产出：
 *   src/lib/opc/generated/pages.json         每个路由的 <main> HTML + 标题
 *   src/lib/opc/generated/article-shell.json  /newsdetail 正文外壳
 *   src/lib/opc/generated/manifest.json       编译清单（来源、页数、校验和）
 *   public/opc/reference/main.css             参考站样式基线（运行时引用）
 *   public/opc/reference/img/*                参考站图片素材（运行时引用）
 *
 * 编译期做的四件事：
 *   1. 抽取 <main>（页头/页尾由 React 外壳渲染，不进产物）；
 *   2. 链接改写：参考站的 .html 相对路径 → 站内路由；assets/ → /opc/reference/；
 *   3. 清理：剥离编辑器节点属性、随机 id、内联脚本；
 *   4. 净化：sanitize-html 白名单（保留 SVG 与参考站用到的内联样式）。
 *
 * 用法：node scripts/build-opc-reference.mjs
 */
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import sanitizeHtml from 'sanitize-html';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(repoRoot, 'scripts/opc-reference');
const pagesSource = join(sourceRoot, 'pages');
const generatedDir = join(repoRoot, 'src/lib/opc/generated');
const publicDir = join(repoRoot, 'public/opc/reference');

/** 公开站点的 CSS 作用域根：只有 .opc-site 内的元素才吃参考站样式，后台不受影响。 */
const CSS_SCOPE = '.opc-site';

/**
 * 路由表：站内路由 → 参考站页面文件。
 *
 * 路由 slug 与参考站保持一致（复刻 = 沿用参考站的信息架构），
 * 旧路由在 next.config.ts 的 redirects() 里 308 收敛过来。
 */
const ROUTES = [
  { path: '/', source: 'index.html' },
  { path: '/about', source: 'about.html' },
  { path: '/health', source: 'health.html' },
  { path: '/empower', source: 'empower.html' },
  { path: '/market', source: 'market.html' },
  { path: '/growth', source: 'growth.html' },
  { path: '/academy', source: 'academy.html' },
  { path: '/news', source: 'news.html' },
  { path: '/apply', source: 'join.html' },
  { path: '/agent', source: 'agent.html' },
];

/** 参考站内部页面链接 → 站内路由（锚点原样保留）。 */
const PAGE_LINKS = {
  'index.html': '/',
  'about.html': '/about',
  'health.html': '/health',
  'empower.html': '/empower',
  'market.html': '/market',
  'growth.html': '/growth',
  'academy.html': '/academy',
  'news.html': '/news',
  'join.html': '/apply',
  'agent.html': '/agent',
};

/* ── 净化白名单 ─────────────────────────────────────────────────────────── */

const ALLOWED_TAGS = [
  'a', 'abbr', 'article', 'aside', 'b', 'blockquote', 'br', 'button', 'caption', 'cite',
  'code', 'dd', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer', 'form', 'h1',
  'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img', 'input', 'label', 'legend',
  'li', 'main', 'nav', 'ol', 'option', 'p', 'pre', 'section', 'select', 'small', 'span',
  'strong', 'sub', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead',
  'time', 'tr', 'ul',
  // SVG（参考站大量内联图标，必须保留 viewBox 等大小写敏感属性）
  'svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'defs',
  'use', 'text', 'tspan', 'title',
];

const ALLOWED_ATTRIBUTES = {
  '*': ['class', 'id', 'style', 'title', 'role', 'aria-label', 'aria-hidden', 'aria-selected', 'aria-live', 'data-d', 'data-opc-block', 'hidden'],
  a: ['href', 'target', 'rel', 'name'],
  img: ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
  input: ['type', 'name', 'value', 'placeholder', 'required', 'checked', 'min', 'max', 'step'],
  select: ['name', 'required', 'multiple'],
  option: ['value', 'selected', 'disabled'],
  textarea: ['name', 'placeholder', 'required', 'rows', 'maxlength'],
  button: ['type', 'name', 'value', 'disabled', 'data-cat', 'data-news-filter', 'data-sd', 'aria-pressed'],
  label: ['for'],
  form: ['id', 'name', 'novalidate', 'action', 'method'],
  svg: ['viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'preserveAspectRatio', 'xmlns'],
  path: ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'opacity'],
  circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke'],
  line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width'],
  polyline: ['points', 'fill', 'stroke', 'stroke-width'],
  polygon: ['points', 'fill', 'stroke', 'stroke-width'],
  ellipse: ['cx', 'cy', 'rx', 'ry', 'fill', 'stroke'],
  use: ['href', 'x', 'y'],
  text: ['x', 'y', 'fill', 'font-size'],
  tspan: ['x', 'y', 'fill'],
};

/**
 * 内联样式白名单：参考站靠内联 style 表达设计，属性越多还原越准；
 * 但值必须受控（防 url()/expression 注入），故逐属性限定取值形态。
 */
const ALLOWED_STYLES = {
  '*': {
    color: [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s.,%]+\)$/, /^var\(--[a-z0-9-]+\)$/, /^[a-zA-Z]+$/],
    background: [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s.,%]+\)$/, /^var\(--[a-z0-9-]+\)$/, /^none$/],
    'background-color': [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\([\d\s.,%]+\)$/],
    display: [/^(block|inline|inline-block|flex|grid|none|inline-flex)$/],
    position: [/^(relative|absolute|fixed|sticky|static)$/],
    'flex-wrap': [/^(wrap|nowrap)$/],
    'flex-direction': [/^(row|column|row-reverse|column-reverse)$/],
    flex: [/^\d+(?:\.\d+)?(?:\s+\d+(?:\.\d+)?)?(?:\s+(?:0 0 auto|auto|1 1 auto))?$/, /^1$/],
    'align-items': [/^(center|flex-start|flex-end|baseline|stretch|space-between)$/],
    'align-self': [/^(center|flex-start|flex-end|stretch)$/],
    'justify-content': [/^(center|flex-start|flex-end|space-between|space-around)$/],
    gap: [/^[\d.]+(?:px|rem|em|%)?(?:\s+[\d.]+(?:px|rem|em|%)?)?$/],
    margin: [/^[\d.]+(?:px|rem|em|%|auto)(?:\s+[\d.]+(?:px|rem|em|%|auto))?(?:\s+[\d.]+(?:px|rem|em|%|auto))?(?:\s+[\d.]+(?:px|rem|em|%|auto))?$/],
    'margin-top': [/^[\d.]+(?:px|rem|em|%)?$/],
    'margin-bottom': [/^[\d.]+(?:px|rem|em|%)?$/],
    'margin-left': [/^[\d.]+(?:px|rem|em|%)?$/],
    'margin-right': [/^[\d.]+(?:px|rem|em|%)?$/],
    padding: [/^[\d.]+(?:px|rem|em|%)(?:\s+[\d.]+(?:px|rem|em|%))?(?:\s+[\d.]+(?:px|rem|em|%))?(?:\s+[\d.]+(?:px|rem|em|%))?$/],
    'padding-top': [/^[\d.]+(?:px|rem|em|%)?$/],
    'padding-bottom': [/^[\d.]+(?:px|rem|em|%)?$/],
    'font-size': [/^[\d.]+(?:px|rem|em|%)$/],
    'font-weight': [/^(normal|bold|bolder|lighter|[1-9]00)$/],
    'font-style': [/^(normal|italic|oblique)$/],
    'line-height': [/^[\d.]+$/, /^[\d.]+(?:px|rem|em|%)$/],
    'text-align': [/^(left|right|center|justify)$/],
    'white-space': [/^(normal|pre|pre-wrap|nowrap)$/],
    'letter-spacing': [/^-?[\d.]+(?:px|rem|em)$/],
    'list-style': [/^none$/, /^[\w-]+$/],
    width: [/^[\d.]+(?:px|rem|em|%|vw|vh)$/, /^auto$/, /^100%$/],
    height: [/^[\d.]+(?:px|rem|em|%|vh)$/, /^auto$/],
    'max-width': [/^[\d.]+(?:px|rem|em|%|vw)$/],
    'aspect-ratio': [/^[\d.]+(?:\s*[:/]\s*[\d.]+)?$/],
    'border-radius': [/^[\d.]+(?:px|rem|%|em)(?:\s+[\d.]+(?:px|rem|%|em))?(?:\s+[\d.]+(?:px|rem|%|em))?(?:\s+[\d.]+(?:px|rem|%|em))?$/],
    border: [/^(?:\d+(?:px|em)?\s+)?(?:solid|dashed|dotted|none)\s*(?:#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\))?(?:\s+[\d.]+(?:px|em))?$/],
    'border-bottom': [/^(?:\d+(?:px|em)?\s+)?(?:solid|dashed|dotted|none)\s*(?:#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\))?$/],
    opacity: [/^[\d.]+$/],
    cursor: [/^(pointer|default|auto)$/],
    'box-shadow': [/^[#\da-zA-Z0-9(),.\s%-]+$/],
    'accent-color': [/^#[0-9a-fA-F]{3,8}$/],
    order: [/^-?\d+$/],
  },
};

const SANITIZE_OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  allowedStyles: ALLOWED_STYLES,
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  // 参考站是相对路径；编译期已改写成站内绝对路径，这里只放行站内路径与 https。
  allowedClasses: false,
  parser: { lowerCaseAttributeNames: false, lowerCaseTags: false },
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
  transformTags: {
    // 外链一律补 rel；去掉 target 之外的协议相对写法
    a: (tagName, attribs) => {
      const next = { ...attribs };
      if (next.target === '_blank') next.rel = 'noopener noreferrer';
      else delete next.target;
      return { tagName, attribs: next };
    },
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: attribs.loading ?? 'lazy', decoding: attribs.decoding ?? 'async' },
    }),
  },
  exclusiveFilter: (frame) => {
    if (frame.tag === 'img') {
      const src = frame.attribs.src ?? '';
      // 站内素材（编译期已改写为 /opc/reference/...）或 https 外链才留
      return !src.startsWith('/opc/reference/') && !src.startsWith('https://');
    }
    return false;
  },
};

/* ── 编译步骤 ──────────────────────────────────────────────────────────── */

/** 参考站随机 id（20+ 位字母数字）不是锚点，语义锚点都是小写短词。 */
const RANDOM_ID = /^[A-Za-z0-9]{20,}$/;

/**
 * 把「多选 chip」的包裹元素从 <span> 改成 <label>。
 *
 * 参考站原文用 <span> 包裹 checkbox：**点文字不会勾选**，只能点 15px 的小方块，
 * 触控目标远小于 WCAG 2.2 SC 2.5.8 AA 的 24×24。
 * 改成 <label> 后整块 chip 都是点击热区（点文字即勾选），
 * 响应式审计里「input 位于 label 内」这一豁免也随之成立。
 */
function promoteCheckboxChips(html) {
  return html.replace(
    /<span style="display:inline-flex;align-items:center;gap:7px;font-size:13\.5px;font-weight:600;color:#42566E;background:#FCFDFF;border:1px solid #E4EBF5;border-radius:9px;padding:8px 13px;cursor:pointer;margin:0">(<input type="checkbox"[^>]*>)([^<]*)<\/span>/g,
    '<label class="needchip">$1$2</label>',
  );
}

/**
 * 移除 /news 列表底部那张「订阅提示卡」。
 *
 * 参考站原文：
 *   「资讯由社区运营团队维护。想第一时间收到活动通知？」+「留下联系方式」按钮
 * 用户 2026-11-10 要求删掉这块布局。
 *
 * 只作用于 /news（该卡片全站仅此一处），用内联样式串精确定位，避免误伤其它卡片。
 */
function removeNewsSubscribeCard(html) {
  return html.replace(
    /\s*<div class="card rv" style="margin-top:26px;padding:24px;text-align:center;background:#F7FAFF">[\s\S]*?<\/div>/,
    '',
  );
}

/**
 * 把空值布尔属性规范成 HTML5 显式形式（hidden="" → hidden="hidden"）。
 *
 * sanitize-html 的 nonBooleanAttributes 列表（按 HTML 规范派生）里含 hidden，
 * 因此 `hidden=""` 这类**空值**布尔属性会被净化器直接丢弃 ——
 * 参考站靠它做「需求表单 / 结果卡」的初始隐藏，丢了就一进页面全展开。
 * 写成 name="name" 后值非空，净化器就会保留。
 */
const BOOLEAN_ATTRS = ['hidden', 'disabled', 'required', 'readonly', 'checked', 'selected', 'multiple', 'autofocus'];

function normalizeBooleanAttrs(html) {
  let out = html;
  for (const attr of BOOLEAN_ATTRS) {
    out = out.replace(new RegExp(`\\s${attr}=""`, 'g'), ` ${attr}="${attr}"`);
  }
  return out;
}

/**
 * 把「提交成功」提示框移出 <form>。
 *
 * 参考站新版把 #joinOk 放在 form **内部**；本站提交成功时会隐藏整个表单
 * （joinForm.style.display = 'none'），提示框会跟着一起消失 —— 用户看不到结果。
 * 移到表单外并补 role=status / aria-live=polite（读屏器也能播报）。
 */
function moveJoinOkOutsideForm(html) {
  return html.replace(
    // 4 组：①属性 ②内容 ③okbox 与 </form> 之间的内容 ④</form> 本身
    /<div class="okbox" id="joinOk"([^>]*)>([\s\S]*?)<\/div>([\s\S]*?)(<\/form>)/,
    '$3$4<div class="okbox" id="joinOk"$1 role="status" aria-live="polite">$2</div>',
  );
}

/**
 * 供需发布表单的提示语：参考站原文说「静态演示版：内容不会上传服务器，只在您本机生成」——
 * 那对参考站成立，但**对本站不成立**（本站表单直连 POST /api/leads，线索真的入库）。
 * 照抄会在页面上对用户说假话，因此这里改成准确口径。
 *
 * 快照保持忠实（只改备案号），项目专属的文案修正统一放在这一层。
 */
function correctMarketFormNote(html) {
  return html.replace(
    /这是静态演示版：内容不会上传服务器，只在您本机生成。正式收集系统上线后，此表单直连后台并进入撮合池。/,
    '提交后进入社区线索池，由运营审核并对接；如后台提交失败，仍可复制文案自行对接。',
  );
}

/**
 * 「同意条款」勾选框同样提升为 <label> 包裹。
 *
 * 参考站原文是 `<div class="checks field"><input type="checkbox" name="agree">…<span>…</span></div>`：
 * 文字与勾选框是兄弟节点，**点文字不会勾选**，勾选框本身只有 15px。
 * 提升为 <label> 后整行都是点击热区，触控目标也满足 24×24。
 */
function promoteAgreeCheckbox(html) {
  return html.replace(
    /(<div class="checks field"[^>]*>)(\s*)(<input type="checkbox" name="agree"[^>]*>)(\s*)(<span>[\s\S]*?<\/span>)(\s*<\/div>)/g,
    '$1$2<label class="agree-check">$3$4$5</label>$6',
  );
}

function extractMain(html) {
  const match = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (!match) throw new Error('页面里找不到 <main>');
  return match[1];
}

/** 剥掉内联脚本与编辑器残留节点属性。 */
function stripScripts(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*\/>/gi, '')
    .replace(/\son[a-z]+="[^"]*"/gi, '')
    .replace(/\sdata-page-node-id="[^"]*"/gi, '')
    .replace(/\sdata-sp-[a-z-]+="[^"]*"/gi, '');
}

/** 随机 id 属性去掉；语义锚点保留。 */
function stripRandomIds(html) {
  return html.replace(/\sid="([^"]*)"/g, (full, id) => (RANDOM_ID.test(id) ? '' : full));
}

/** 参考站的 .html 相对链接 → 站内路由；assets/ → 运行时素材目录。 */
function rewriteLinks(html) {
  return html
    .replace(/(href|src)="assets\/([^"]+)"/g, (_full, attr, rest) => `${attr}="/opc/reference/${rest}"`)
    .replace(/href="([a-z]+\.html)(#[^"]*)?"/g, (_full, file, hash = '') => {
      const route = PAGE_LINKS[file];
      return route ? `href="${route}${hash}"` : _full;
    });
}

/** 站内路由表里没有的 .html 链接（参考站内部跳转）兜底成 /。 */
function neutraliseUnknownLinks(html) {
  return html.replace(/href="([a-z]+\.html)(#[^"]*)?"/g, (_full, _file, hash = '') => `href="/${hash}"`);
}

/* ── 动态区块锚点（DB 唯一事实源在运行期注入这些容器）─────────────────── */

/**
 * 在编译期把「需要接数据库」的容器打上稳定标记，
 * 运行时（src/lib/opc/blocks-runtime.ts）按标记定位并整体替换内部。
 */
function markDynamicBlocks(route, html) {
  const path = route.path;
  let out = html;

  if (path === '/') {
    // 首页首屏背景图：后台 home_banners 接管（步骤条与左右切换由前台脚本挂上）
    out = out.replace(/<div class="hero__bg"([^>]*)>/, '<div class="hero__bg"$1 data-opc-block="home-banners">');
    // 首页 hero 统计墙：参考站容器存在但为空，后台 site_stats 接管
    out = out.replace(/<div class="hero__stats"([^>]*)>/, '<div class="hero__stats"$1 data-opc-block="home-stats">');
    // 首页动态四卡：社区动态前四条
    out = out.replace(/<div class="newsgrid newsgrid--4"([^>]*)>/, '<div class="newsgrid newsgrid--4"$1 data-opc-block="home-news">');
  }

  if (path === '/academy') {
    // 集智商学院课程体系：后台 courses 接管
    out = out.replace(/<div class="ac-crs"([^>]*)>/, '<div class="ac-crs"$1 data-opc-block="course-grid">');
  }

  if (path === '/news') {
    // 社区动态列表：后台 news_posts 接管
    out = out.replace(/<div class="newslist"([^>]*)>/, '<div class="newslist"$1 data-opc-block="news-list">');
  }

  if (path === '/agent') {
    out = out.replace(/<div class="agrid"([^>]*)>/, '<div class="agrid"$1 data-opc-block="agent-grid">');
  }

  if (path === '/about') {
    // 发展历程 / 服务对象：参考站导航的下拉项约定了 #history / #who 两个锚点，
    // 但参考站 about 页本身只有 #intro 与 #drivers —— 这里按参考站已有的事实补齐，
    // 不新增任何未经参考站确认的数字或承诺。
    out = out.replace(
      /<section class="sec sec--bg" id="drivers">/,
      `<section class="sec" id="history">
  <div class="wrap">
    <div class="shead shead--center">
      <span class="eyebrow">MILESTONES · 发展历程</span>
      <h2>从产业积累，走到社区落地</h2>
      <p class="sub">集团四十余年的产业积累，是集智 AI OPC 社区的起点。</p>
    </div>
    <div class="grid g3">
      <div class="card rv vis">
        <span class="card__no" style="font-size:34px">01</span>
        <h3>四十余年产业积累</h3>
        <p>从家居市场走到健康管理，集团四十余年的产业实践是这套赋能体系的地基。</p>
      </div>
      <div class="card rv vis" data-d="1">
        <span class="card__no" style="font-size:34px">02</span>
        <h3>2026 年 10 月启动运营</h3>
        <p>集智 AI OPC 社区正式启动运营，面向 AI 创业团队与「一人公司」开放。</p>
      </div>
      <div class="card rv vis" data-d="2">
        <span class="card__no" style="font-size:34px">03</span>
        <h3>首期 3000+ ㎡ 空间启用</h3>
        <p>首期 3000+ ㎡ 共享空间落地北京市丰台区集美家居大红门店3号厅2层 集智OPC社区，八大赋能一站式配齐。</p>
      </div>
    </div>
  </div>
</section>
<section class="sec sec--bg" id="who">
  <div class="wrap">
    <div class="shead shead--center">
      <span class="eyebrow">WHO · 服务对象</span>
      <h2>谁在这栋楼里做事</h2>
      <p class="sub">不止创业者：企业、院校与学员都在同一条链路上。</p>
    </div>
    <div class="grid g3">
      <div class="card rv vis">
        <h3>AI 创业团队与一人公司</h3>
        <p>社区为 AI 创业团队与「一人公司」准备，把空间、算力、订单与流量接成一条线。</p>
      </div>
      <div class="card rv vis" data-d="1">
        <h3>集团生态企业与服务机构</h3>
        <p>企服超市承接人事、财税、法务与知产，丰台区人力资源服务中心与青创会已驻场，办事窗口就在楼里。</p>
      </div>
      <div class="card rv vis" data-d="2">
        <h3>院校与学员</h3>
        <p>集智商学院提供实战课程与一站式就业服务，院校可做产教共建，学员按实训—就业—合伙的路径成长。</p>
      </div>
    </div>
  </div>
</section>
<section class="sec sec--bg" id="drivers">`,
    );

    // 生态伙伴：后台 partners 接管（参考站导航里约定了该锚点）
    out = out.replace(
      /<section class="cta">/,
      `<section class="sec" id="eco" data-opc-block="partners">
  <div class="wrap">
    <div class="shead shead--center">
      <span class="eyebrow">ECOSYSTEM · 生态伙伴</span>
      <h2>与产业伙伴共建 AI 生态</h2>
      <p class="sub">合作伙伴由后台统一维护，名单与标识实时同步。</p>
    </div>
    <ul class="partner-wall" data-opc-block="partner-grid"></ul>
  </div>
</section>
<section class="cta">`,
    );
  }

  return out;
}

/* ── /newsdetail 正文外壳 ──────────────────────────────────────────────── */

function buildArticleShell() {
  return {
    html: `<section class="sec sec--bg">
  <div class="wrap">
    <article class="news-detail">
      <span class="ntag">__OPC_CATEGORY__</span>
      <h1 class="news-detail__title">__OPC_TITLE__</h1>
      <time class="news-detail__date">__OPC_DATE__</time>
      <div class="news-detail__body">__OPC_ARTICLE__</div>
    </article>
  </div>
</section>`,
  };
}

/* ── 样式作用域化 ──────────────────────────────────────────────────────── */

/**
 * 修复参考站样式表的括号失衡。
 *
 * 参考站 CSS 第 777 行有一个**多余的 `}`**（浏览器容错忽略，postcss 会报错）。
 * 这里按「花括号深度」逐字符扫描，跳过字符串与注释，深度为 0 时遇到的 `}` 直接丢弃。
 */
function repairCss(css) {
  let out = '';
  let depth = 0;
  let quote = '';
  let inComment = false;
  for (let i = 0; i < css.length; i += 1) {
    const char = css[i];
    const next = css[i + 1];
    if (inComment) {
      out += char;
      if (char === '*' && next === '/') {
        out += next;
        i += 1;
        inComment = false;
      }
      continue;
    }
    if (quote) {
      out += char;
      if (char === '\\') {
        out += next ?? '';
        i += 1;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '/' && next === '*') {
      out += char + next;
      i += 1;
      inComment = true;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      out += char;
      continue;
    }
    if (char === '{') {
      depth += 1;
      out += char;
      continue;
    }
    if (char === '}') {
      if (depth === 0) continue; // 多余的右括号：丢弃
      depth -= 1;
      out += char;
      continue;
    }
    out += char;
  }
  // 结束时若仍有未闭合的块，补齐右括号
  return out + '}'.repeat(Math.max(0, depth));
}

/**
 * 给参考站样式表的所有选择器加作用域前缀。
 *
 * 为什么必须做：参考站 CSS 含全局重置（`body`/`h1..h5`/`p`/`ul`/`img`/`button`…），
 * 直接整份引入会覆盖后台（Tailwind）与管理页的排版。
 *
 * 规则：
 *   - `:root` → `.opc-site`（变量定义在作用域根上，子元素继承）
 *   - `html` / `body` → `html` 保持全局（scroll-behavior / scroll-padding 与作用域无关），
 *     `body` 的排版属性改挂到 `.opc-site` 上
 *   - `@keyframes` / `@font-face` / `@supports` 的**内部 at-rule 规则**不加前缀
 *   - 其余一律加前缀
 */
function scopeCss(css) {
  const root = postcss.parse(repairCss(css));
  root.walkAtRules((atRule) => {
    if (atRule.name === 'keyframes' || atRule.name === '-webkit-keyframes') return;
    atRule.walkRules((rule) => {
      rule.selectors = rule.selectors.map((selector) => scopeSelector(selector));
    });
  });
  root.walkRules((rule) => {
    if (rule.parent && rule.parent.type === 'atrule') return; // at-rule 内已处理
    rule.selectors = rule.selectors.map((selector) => scopeSelector(selector));
  });
  return root.toString();
}

/** 单条选择器加前缀：`:root` 变成作用域根，`body` 挂到作用域根，`html` 保持全局。 */
function scopeSelector(selector) {
  const trimmed = selector.trim();
  if (trimmed === ':root') return CSS_SCOPE;
  // html 级属性（scroll-behavior / scroll-padding / text-size-adjust）对全站无副作用，
  // 且锚点偏移依赖 scroll-padding-top —— 保持全局，不加前缀。
  if (trimmed === 'html') return 'html';
  if (trimmed === 'html, body') return `html, ${CSS_SCOPE}`;
  if (trimmed === 'body') return CSS_SCOPE;
  if (trimmed === '::selection' || trimmed === '::selection, *::selection') {
    return trimmed.replace(/::selection/g, `${CSS_SCOPE} ::selection`);
  }
  return `${CSS_SCOPE} ${trimmed}`;
}

/* ── 主流程 ────────────────────────────────────────────────────────────── */

function compilePage(route) {
  const raw = readFileSync(join(pagesSource, route.source), 'utf8');
  // 标题**从参考站 <title> 直接提取**（不硬编码）——参考站改标题时自动跟随，
  // 避免「编译产物标题与原件不一致」这类漂移。
  const title = (raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  let html = extractMain(raw);
  html = stripScripts(html);
  html = stripRandomIds(html);
  html = promoteCheckboxChips(html);
  html = promoteAgreeCheckbox(html);
  html = correctMarketFormNote(html);
  html = moveJoinOkOutsideForm(html);
  html = normalizeBooleanAttrs(html);
  if (route.path === '/news') html = removeNewsSubscribeCard(html);
  html = rewriteLinks(html);
  html = neutraliseUnknownLinks(html);
  html = markDynamicBlocks(route, html);
  html = sanitizeHtml(html, SANITIZE_OPTIONS);
  return { title, html: html.trim() };
}

function main() {
  mkdirSync(generatedDir, { recursive: true });
  mkdirSync(join(publicDir, 'img'), { recursive: true });

  const pages = {};
  const checksums = {};

  for (const route of ROUTES) {
    const page = compilePage(route);
    pages[route.path] = page;
    checksums[route.path] = createHash('sha256').update(page.html).digest('hex').slice(0, 16);
    console.log(`[page] ${route.path.padEnd(9)} ${String(page.html.length).padStart(6)}B  ← ${route.source}`);
  }

  writeFileSync(join(generatedDir, 'pages.json'), `${JSON.stringify(pages, null, 1)}\n`, 'utf8');
  writeFileSync(
    join(generatedDir, 'article-shell.json'),
    `${JSON.stringify(buildArticleShell(), null, 1)}\n`,
    'utf8',
  );

  // 样式基线 + 图片素材 → 运行时目录
  const scopedCss = scopeCss(readFileSync(join(sourceRoot, 'assets/css/main.css'), 'utf8'));
  writeFileSync(join(publicDir, 'main.css'), scopedCss, 'utf8');
  const imgDir = join(sourceRoot, 'assets/img');
  let imageCount = 0;
  for (const name of readdirSync(imgDir)) {
    copyFileSync(join(imgDir, name), join(publicDir, 'img', name));
    imageCount += 1;
  }
  copyFileSync(join(sourceRoot, 'assets/img/favicon.svg'), join(publicDir, 'favicon.svg'));

  const manifest = {
    source: 'https://jizhi-ai-opc.app.workbuddy.host/',
    capturedBy: 'scripts/fetch-opc-reference.mjs',
    compiledBy: 'scripts/build-opc-reference.mjs',
    routeCount: ROUTES.length,
    images: imageCount,
    checksums,
  };
  writeFileSync(join(generatedDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`\n产物：pages.json(${Object.keys(pages).length} 页) · article-shell.json · main.css · ${imageCount} 张图片`);
}

main();
