#!/usr/bin/env node
/**
 * OPC 复刻站 · 文本对比度实测（零依赖，CDP over Node 内置 WebSocket）
 *
 * ## 为什么必须实测而不是推算
 *
 * 复刻页的背景**不是纯色**：首页 hero 是实时渲染的深蓝主视觉，
 * 内页有渐变、网格纹理与半透明蒙版。静态取色、`rgba` 叠加推算、
 * 理论计算全部会漏判 —— 同一句话在不同滚动位置、不同断点下，
 * 结论可能相反。
 *
 * 因此这里做**真实像素采样**：
 *   1. 滚动到目标位置 → 截图（保证截图与 DOM 坐标同一坐标系）；
 *   2. 页面内把截图解成位图，用 `Range.getClientRects()` 定位每个文字元素；
 *   3. 采样该范围内像素，**剔除接近前景色的像素**（那是字形本身）；
 *   4. 取众数当背景色，算 WCAG 比值。
 *
 * ## 三个必须遵守的实现约束（都是实测踩出来的）
 *
 * 1. **先滚动、再截图**。`getClientRects()` 返回的是视口坐标，
 *    截图也是视口截图；先截后滚会让两者坐标系错位，采样到错误区域。
 * 2. **直接用 `data:` URL 给 `img.src`，不要经过 blob**。
 *    blob URL 在部分情况下会让 canvas 被标记为 tainted，
 *    `getImageData()` 抛 SecurityError，整个采样静默失败。
 * 3. **`new Image()` 的加载是异步的**：同步调用会抛 `InvalidStateError`，
 *    必须 `await img.decode()`，并给 `Runtime.evaluate` 加 `awaitPromise: true`。
 *
 * 用法：node scripts/opc-contrast.mjs [--base http://localhost:3000]
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9402;
const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith('--base=')) || '--base=http://localhost:3000').slice(7);

const PAGES = [
  // 2026-10-26 口径：/computingresource（GPU 资源页）已下线，从采样清单移除。
  '/', '/about', '/agent', '/market', '/center', '/starproject',
  '/community', '/work', '/newslist',
  '/activitylist', '/newsdetail?id=392', '/zone?city=上海',
  '/opclogin', '/opcregister',
];

/** 断点：桌面 + 移动。多断点是必须的 —— 背景会动，结论随位置变。 */
const VIEWPORTS = [
  { width: 1440, height: 900, dpr: 1, mobile: false, label: '1440' },
  { width: 390, height: 844, dpr: 2, mobile: true, label: '390' },
];

/**
 * 滚动位置：首屏 + 三个中段。
 *
 * 采样是**视口内像素采样** —— 元素不在视口里就采不到，
 * 所以覆盖度直接取决于滚动位置的个数。
 * 只采 0 与 0.45 时，中后段的区块会整段漏掉：
 * 2026-10-22 实测 `/work` 页的 `.stat-description`（原站 #a3a3a3，2.39:1）
 * 正是在 scroll=0.45 之后才落进采样区，才被当场抓出来。
 * 四个等距位置能让「0 处不达标」覆盖整页而不是中段。
 */
const SCROLLS = [0, 0.3, 0.6, 0.9];

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
  '--no-default-browser-check', '--hide-scrollbars',
  '--user-data-dir=/tmp/jz-contrast', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    for (const host of ['127.0.0.1', '[::1]']) {
      try {
        const r = await fetch(`http://${host}:${PORT}/json/version`);
        const j = await r.json();
        if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
      } catch { /* 还没起来 */ }
    }
    await sleep(250);
  }
  throw new Error('Chrome 调试端口未就绪');
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: rs, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : rs(msg.result);
    }
  });
  const ready = new Promise((rs) => ws.addEventListener('open', () => rs()));
  return {
    ready,
    send(method, params = {}, sessionId) {
      const mid = ++id;
      const payload = { id: mid, method, params };
      if (sessionId) payload.sessionId = sessionId;
      ws.send(JSON.stringify(payload));
      return new Promise((rs, reject) => pending.set(mid, { resolve: rs, reject }));
    },
    close() { ws.close(); },
  };
}

/**
 * 等待页面内所有图片加载完成（最多 6s）。
 *
 * ⚠️ 图片插入会改变文档高度 → 滚动落点与元素 rect 都会漂。
 * 测量前必须等图片就位，否则采样到的背景色是错的。
 */
const IMAGES_READY = `(async () => {
  // ⚠️ 先屏蔽 Next.js 的**开发指示器**浮层（nextjs-portal）。
  // 它是 dev-only 的开发工具徽章（深色底 #2e2f31），会盖在页面上，
  // 像素采样正好落在它上面时会把背景读成深色 —— 实测
  // 「/nanjingzone 移动端 .njz-count b」就是这样被判成 2.28:1 的假失败。
  // 生产环境不存在这个元素，所以测量时必须排除。
  if (!document.getElementById('opc-audit-hide-devtools')) {
    const style = document.createElement('style');
    style.id = 'opc-audit-hide-devtools';
    style.textContent = 'nextjs-portal,next-route-announcer{display:none !important}';
    document.head.appendChild(style);
  }
  const pending = [...document.images].filter((i) => !i.complete);
  const timeout = new Promise((r) => setTimeout(r, 6000));
  await Promise.race([
    Promise.all(pending.map((i) => new Promise((r) => {
      i.addEventListener('load', r, { once: true });
      i.addEventListener('error', r, { once: true });
    }))),
    timeout,
  ]);
  return document.images.length;
})()`;

/**
 * 等待**当前视口内**的图片加载并解码完成（最多 8s）。
 *
 * ⚠️ 为什么 IMAGES_READY 不够：它在**滚动之前**执行，而站点大量使用
 * `loading="lazy"`。视口外的图片在滚动到位之前**根本不会发起请求**，
 * `img.complete` 恒为 false → IMAGES_READY 只能白等超时。
 *
 * 实测（生产模式）：首页 `/about-sec` 的背景图 `.about-bg-el img`
 * 在滚动到 scroll=0.6 后才开始加载；脚本立刻截图，采到的是
 * **webp 渐进解码的中间态**（灰像素 rgb(179,180,181) / rgb(120,123,125)），
 * 于是 `.adg-item-desc` 的白字被判成 1.85:1 / 3.43:1 —— **假失败**。
 * 图片真正解码完成后（实测进视口后 82ms 即完成），原图被
 * `filter:brightness(.5)` 压暗，白字真实对比度是 **12.6:1 ~ 17.2:1**。
 *
 * 所以滚动落地之后必须再等一次「视口内图片解码完成」，
 * 并且要用 `img.decode()` 而不是只看 `complete` —— `complete` 只代表
 * 数据到齐，不代表已经解码成可采样的像素。
 */
const VISUAL_READY = `(async () => {
  const vh = window.innerHeight;
  const inView = [...document.images].filter((i) => {
    const r = i.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > -60 && r.top < vh + 60;
  });
  const timeout = new Promise((r) => setTimeout(r, 8000));
  await Promise.race([
    Promise.all(inView.map(async (i) => {
      if (!i.complete) {
        await new Promise((res) => {
          i.addEventListener('load', res, { once: true });
          i.addEventListener('error', res, { once: true });
        });
      }
      try { await i.decode(); } catch {}
    })),
    timeout,
  ]);
  return inView.length;
})()`;

/**
 * 页面内采样脚本。
 * `window.__opcShot` 由外部注入为 data URL（避免 blob 污染 canvas）。
 */
const MEASURE = String.raw`(async () => {
  const root = document.querySelector('.opc-replica');
  if (!root) return { error: 'no replica root' };
  const shot = window.__opcShot;
  if (!shot) return { error: 'no screenshot injected' };

  let img;
  try {
    img = new Image();
    img.src = shot;
    await img.decode();
  } catch (e) {
    return { error: 'decode failed: ' + e.message };
  }

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  const dpr = window.devicePixelRatio || 1;

  const parseColor = (value) => {
    const m = String(value).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] };
  };
  const luminance = (r, g, b) => {
    const f = (v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  // 元素的祖先链（tag + 前两个类名），用于把对比度失败项直接定位回源码，
  // 避免只拿到 className 就得反查 DOM 结构。
  const domPath = (el) => {
    const parts = [];
    let n = el;
    for (let i = 0; n && i < 4 && n.nodeType === 1; i++, n = n.parentElement) {
      const cls = String(n.className || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      parts.push(n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (cls ? '.' + cls : ''));
    }
    return parts.join(' < ');
  };

  const dbg = { targets: 0, skippedFg: 0, skippedGeom: 0, sampled: 0, buckets: 0, exempt: 0, occluded: 0 };
  const targets = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.trim();
    if (!text || text.length < 2) continue;
    const el = node.parentElement;
    if (!el) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || +style.opacity === 0) continue;
    // 用 Range 精确取文字行的像素范围。
    // ⚠️ createRange().selectNodeContents(node) 返回的 Range 在个别情况下
    // 没有 getClientRects（跨 shadow root / 已 detach 的节点），
    // 因此逐段 try/catch，退化到元素自身的 bounding rect。
    let rect = null;
    try {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = range.getClientRects();
      if (rects && rects.length) rect = rects[0];
    } catch (e) { /* 退回元素 rect */ }
    if (!rect) {
      const box = el.getBoundingClientRect();
      if (!box || box.width < 4 || box.height < 4) continue;
      rect = box;
    }
    if (rect.width < 4 || rect.height < 4) continue;
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

    // ⚠️ **必须排除被 fixed 页头遮住的文字**（实测假失败的真凶）。
    //
    // 实测（生产模式）：首页 scroll=0.6 的 .adg-item-desc
    // 「前沿AI技术驱动产业升级」「构建开放协同的创新生态」被判成 1.85:1 / 3.43:1，
    // 采样到的背景是 rgb(179,180,181) —— 这不是文字背后的图，
    // 而是被 **fixed 页头导航**（nav.is-home.scrolled → ul.nav-links → li → a）
    // 盖住后截到的导航底色。
    //
    // 判据用 elementsFromPoint：取文字矩形中心点，若命中栈顶既不是该文字元素、
    // 也不是它的后代或祖先，说明**有别的元素压在它上面** → 采样必然落在遮挡物上，
    // 此时读到的对比度与这个文字的真实对比度无关，直接跳过。
    //
    // ⚠️ 不能只判「rect.top < 页头高度」：页头高度随滚动状态变化（首页首屏深色、
    // 滚后白色），而浮层不止页头一个（还可能有 dev 徽章、浮窗按钮）。
    // elementsFromPoint 是通用判据。
    const cx = Math.round(rect.left + rect.width / 2);
    const cy = Math.round(rect.top + rect.height / 2);
    if (cx >= 0 && cy >= 0 && cx < window.innerWidth && cy < window.innerHeight) {
      const stack = document.elementsFromPoint(cx, cy);
      const top = stack && stack[0];
      if (top && top !== el && !el.contains(top) && !top.contains(el)) {
        dbg.occluded = (dbg.occluded || 0) + 1;
        continue;
      }
    }

    targets.push({ el, text: text.slice(0, 30), style, rect });
  }

  dbg.targets = targets.length;
  const results = [];
  for (const t of targets) {
    const fg = parseColor(t.style.color);
    if (!fg || fg.a < 0.3) { dbg.skippedFg++; continue; }
    const x0 = Math.max(0, Math.round(t.rect.left * dpr));
    const y0 = Math.max(0, Math.round(t.rect.top * dpr));
    const w = Math.min(Math.round(t.rect.width * dpr), canvas.width - x0);
    const h = Math.min(Math.round(t.rect.height * dpr), canvas.height - y0);
    if (w < 2 || h < 2) { dbg.skippedGeom++; continue; }
    let data;
    try {
      data = ctx.getImageData(x0, y0, w, h).data;
    } catch (e) {
      return { error: 'getImageData failed: ' + e.message };
    }
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const dl = Math.abs(r - fg.r) + Math.abs(g - fg.g) + Math.abs(b - fg.b);
      if (dl < 150) continue; // 剔除字形本身
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const bucket = buckets.get(key);
      if (bucket) { bucket.n++; bucket.r += r; bucket.g += g; bucket.b += b; }
      else buckets.set(key, { n: 1, r, g, b });
    }
    dbg.sampled++;
    if (!buckets.size) continue;
    dbg.buckets++;
    let best = null;
    for (const bucket of buckets.values()) if (!best || bucket.n > best.n) best = bucket;
    const bg = { r: best.r / best.n, g: best.g / best.n, b: best.b / best.n };

    // ⚠️ **半透明文字必须先与背景合成再算亮度。**
    // 直接拿 rgba(255,255,255,0.88) 的 RGB 当不透明色用，
    // 等于把 88% 白当成 100% 白 —— 对比度被系统性高估。
    // 正确做法是渲染真实像素：fg·a + bg·(1-a)。
    const comp = fg.a >= 1
      ? { r: fg.r, g: fg.g, b: fg.b }
      : {
        r: fg.r * fg.a + bg.r * (1 - fg.a),
        g: fg.g * fg.a + bg.g * (1 - fg.a),
        b: fg.b * fg.a + bg.b * (1 - fg.a),
      };
    const cr = ratio(luminance(comp.r, comp.g, comp.b), luminance(bg.r, bg.g, bg.b));
    const size = parseFloat(t.style.fontSize);
    const bold = parseInt(t.style.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);

    // ⚠️ **渐变文字（background-clip:text）不能用 computed color 代表绘制色。**
    // 这类元素把背景裁剪到字形里，computed color 只是占位；
    // 真实绘制色是渐变本身。若按 computed color 去剔字形像素，
    // 会把渐变像素当成背景色，算出「白字压蓝底」的假阳性
    // （实测页头品牌字被误判为 4.17:1，实际是蓝色渐变字压白底，完全达标）。
    // WCAG 1.4.3 对 logotype 本身也免对比度要求，这里单列不计入失败。
    const clip = t.style.webkitBackgroundClip || t.style.backgroundClip;
    const gradientText = clip === 'text' && t.style.backgroundImage !== 'none';
    const required = large ? 3 : 4.5;

    results.push({
      text: t.text,
      cls: (t.el.className || '').toString().slice(0, 44),
      path: domPath(t.el),
      size,
      fg: t.style.color,
      bg: 'rgb(' + Math.round(bg.r) + ', ' + Math.round(bg.g) + ', ' + Math.round(bg.b) + ')',
      cr: Math.round(cr * 100) / 100,
      required,
      exempt: gradientText ? 'logotype' : undefined,
      pass: gradientText ? true : cr >= required,
    });
  }
  return { count: results.length, results, dbg, scrollY: window.scrollY };
})()`;

const client = connect(await wsUrl());
await client.ready;
const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
await client.send('Page.enable', {}, sessionId);
await client.send('Runtime.enable', {}, sessionId);

const report = [];
let totalFail = 0;
let totalSampled = 0;

for (const vp of VIEWPORTS) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: vp.width, height: vp.height, deviceScaleFactor: vp.dpr, mobile: vp.mobile,
  }, sessionId);

  for (const path of PAGES) {
    await client.send('Page.navigate', { url: BASE + path }, sessionId);
    // dev 模式下每个路由都要首次编译，实测 2.4s 不够；
    // 以「复刻根容器出现」为就绪信号，最多等 15s。
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      await sleep(250);
      const probe = await client.send('Runtime.evaluate', {
        expression: `!!document.querySelector('.opc-replica')`,
        returnByValue: true,
      }, sessionId);
      ready = probe.result?.value === true;
    }
    if (!ready) { console.log(`✗ ${vp.label} ${path} 页面未就绪`); continue; }
    await sleep(700);

    for (const scroll of SCROLLS) {
      // ⚠️⚠️ **必须用 behavior:'instant'，且必须复核滚动落点。**
      //
      // 主站 `src/styles/globals.css` 里有 `scroll-behavior: smooth`，
      // 普通的 `window.scrollTo(0, y)` 会走平滑动画。实测中滚到长页面中段时，
      // 600ms 之后动画**还没结束** —— 于是：
      //   · 截图那一刻，页面停在滚动位置 A；
      //   · 紧接着读 `getClientRects()` 时，页面已经滚到位置 B；
      // 两者坐标系不一致，采样会落到完全无关的区域上，
      // 产生「4.14:1」这类**假阳性**（/newsdetail 正文段落实测就是如此：
      // 该段落实际在不透明白底上，真实对比度 8.2:1）。
      //
      // 所以这里：instant 滚动 → 等图片加载完（图片插入会改文档高度）
      // → 再按最终文档高度重新定位一次 → 截图 → 读 rect。
      const land = async () => {
        const r = await client.send('Runtime.evaluate', {
          expression: `(() => {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            const top = Math.round(max * ${scroll});
            window.scrollTo({ top, behavior: 'instant' });
            return { want: top, got: window.scrollY, max };
          })()`,
          returnByValue: true,
        }, sessionId);
        return r.result?.value ?? {};
      };

      // 图片未加载完时，布局高度还会变，滚动落点与 rect 都会漂。
      await client.send('Runtime.evaluate', {
        expression: IMAGES_READY, returnByValue: true, awaitPromise: true,
      }, sessionId);

      const first = await land();
      await sleep(350);
      const second = await land();
      await sleep(250);

      // ⚠️ 滚动落地后，等**视口内**的图片解码完成（懒加载图此刻才开始加载）。
      // 不等就会采到渐进解码的中间态 —— 详见 VISUAL_READY 的注释。
      await client.send('Runtime.evaluate', {
        expression: VISUAL_READY, returnByValue: true, awaitPromise: true,
      }, sessionId);

      // 图片就位会改变文档高度 → 再按最终高度重新定位一次。
      const third = await land();
      await sleep(200);

      // CSS 过渡 / 入场动画未结束时，像素采样会拿到**中间态**的颜色。
      // 实测：`.city-btn.active` 的底色正从白过渡到 `--opc-blue-deep` 时，
      // 采样得到中间的浅蓝 `#75aad0` —— 白字压在上面只有 2.49:1，
      // 而稳态是 `#0968ab`（5.86:1）。这是**假失败**，不是设计缺陷。
      // 所以采样前把**有限动画**直接推到终态（无限循环的装饰动画跳过）。
      await client.send('Runtime.evaluate', {
        expression: `(() => {
          const anims = typeof document.getAnimations === 'function' ? document.getAnimations() : [];
          let n = 0;
          for (const a of anims) {
            try {
              const t = a.effect && a.effect.getTiming ? a.effect.getTiming() : null;
              if (t && t.iterations === Infinity) continue;
              a.finish();
              n += 1;
            } catch {}
          }
          return n;
        })()`, returnByValue: true,
      }, sessionId);

      const { data: shot } = await client.send('Page.captureScreenshot', { format: 'png' }, sessionId);
      await client.send('Runtime.evaluate', {
        expression: `window.__opcShot = ${JSON.stringify(`data:image/png;base64,${shot}`)};`,
      }, sessionId);

      const { result } = await client.send('Runtime.evaluate', {
        expression: MEASURE, returnByValue: true, awaitPromise: true,
      }, sessionId);
      const measured = result.value;
      if (!measured || measured.error || !Array.isArray(measured.results)) {
        console.log(`✗ ${vp.label} ${path} ${measured?.error ?? JSON.stringify(measured).slice(0, 200)}`);
        continue;
      }

      // 完整性检查：截图瞬间与读 rect 瞬间必须处在同一个滚动位置。
      if (measured.scrollY !== third.got) {
        console.log(`⚠ ${vp.label} ${path} scroll=${scroll} 截图与采样不在同一滚动位置（${third.got} → ${measured.scrollY}），本次数据作废`);
        continue;
      }
      if (first.got !== third.got) {
        console.log(`⚠ ${vp.label} ${path} scroll=${scroll} 滚动落点漂移（${first.got} → ${third.got}），已按最终文档高度重定位`);
      }

      const fails = measured.results.filter((r) => !r.pass);
      totalFail += fails.length;
      totalSampled += measured.count;
      report.push({ viewport: vp.label, path, scroll, ...measured });

      const status = fails.length ? '✗' : '✓';
      console.log(`${status} ${vp.label.padEnd(5)} ${path.padEnd(26)} scroll=${scroll}  采样 ${String(measured.count).padStart(3)}  失败 ${fails.length}`);
      fails.slice(0, 4).forEach((f) => console.log(`     ${String(f.cr).padStart(6)}:1 (需 ${f.required}) ${f.size}px  fg=${f.fg} bg=${f.bg}  「${f.text}」 ${f.path}`));
    }
  }
}

writeFileSync(resolve(process.cwd(), '.screenshots/opc-contrast.json'), JSON.stringify(report, null, 2));
const totalExempt = report.reduce(
  (n, p) => n + p.results.filter((r) => r.exempt).length, 0,
);
console.log(`\n总采样 ${totalSampled} 处，对比度不达标 ${totalFail} 处，logotype 豁免 ${totalExempt} 处`);
console.log('明细已写入 .screenshots/opc-contrast.json');

client.close();
chrome.kill();
