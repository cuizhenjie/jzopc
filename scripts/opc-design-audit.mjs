#!/usr/bin/env node
/**
 * OPC 复刻页设计基线审计器 —— 零依赖，驱动 headless Chrome（CDP over Node 内置 WebSocket）。
 *
 * 与 responsive-audit.mjs 的区别：那个查「能不能用」（溢出/字号/触控），
 * 这个查「设计体系是否成体系」（视觉层级/配色/字体/间距栅格/组件一致性）。
 *
 * 用法：
 *   node scripts/opc-design-audit.mjs [--base http://localhost:3000] [--shots]
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9344;
const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith('--base=')) || '--base=http://localhost:3000').slice(7);
const SHOTS = args.includes('--shots');
const OUT = resolve(process.cwd(), '.screenshots/design-audit');

/** OPC 复刻的 20 条路由（与 src/lib/opc/routes.ts 一致） */
const PAGES = [
  { path: '/', label: '首页' },
  { path: '/about', label: '关于' },
  { path: '/agent', label: '智能体中心' },
  { path: '/market', label: '交易市场' },
  { path: '/center', label: '集智AI 学院' },
  { path: '/starproject', label: '星计划' },
  { path: '/community', label: 'OPC社区' },
  { path: '/work', label: '工作平台' },
  { path: '/computingresource', label: '算力超市' },
  { path: '/newslist', label: '新闻列表' },
  { path: '/activitylist', label: '活动列表' },
  { path: '/newsdetail?id=392', label: '新闻详情' },
  { path: '/nanjingzone', label: '南京专区' },
  { path: '/zone?city=上海', label: '城市专区' },
  { path: '/starjoin', label: '申请加入' },
  { path: '/opcapply?formType=training', label: '申请表' },
  { path: '/opclogin', label: '登录' },
  { path: '/opcregister', label: '注册' },
];

/* ── 启动 headless Chrome ─────────────────────────────────────────────── */
// 不加 swiftshader 参数：macOS 上 headless 默认走真实 Metal GPU，
// 加了会退化成软件渲染，依赖 fwidth() 的网格/波场 shader 会出现假硬边白线。
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', '--user-data-dir=/tmp/jz-design-audit-profile', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 80; i++) {
    // 调试端口可能绑 IPv6 ::1，也可能绑 IPv4 127.0.0.1，两个都要试。
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

/* ── 极简 CDP 客户端 ──────────────────────────────────────────────────── */
function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const events = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve: rs, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : rs(msg.result);
    } else if (msg.method && events.has(msg.method)) {
      events.get(msg.method).forEach((fn) => fn(msg.params));
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
    on(method, fn) {
      if (!events.has(method)) events.set(method, []);
      events.get(method).push(fn);
    },
    close() { ws.close(); },
  };
}

/* ── 页面内采集脚本（以字符串传入，避免 Node 侧求值） ─────────────────── */
const COLLECT = `(() => {
  const root = document.querySelector('.opc-replica') || document.body;
  const px = (v) => Math.round(parseFloat(v) * 100) / 100;

  const textNodes = [];
  const all = root.querySelectorAll('*');
  for (const el of all) {
    const text = Array.from(el.childNodes)
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent.trim())
      .join(' ')
      .trim();
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    textNodes.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 80) : '',
      text: text.slice(0, 40),
      fontSize: px(cs.fontSize),
      fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      fontFamily: cs.fontFamily.split(',')[0].replace(/["']/g, ''),
      color: cs.color,
      bg: cs.backgroundColor,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform,
      display: cs.display,
      textAlign: cs.textAlign,
      marginTop: px(cs.marginTop),
      marginBottom: px(cs.marginBottom),
      padding: px(cs.paddingTop) + ' ' + px(cs.paddingRight) + ' ' + px(cs.paddingBottom) + ' ' + px(cs.paddingLeft),
      paddingTop: px(cs.paddingTop),
      paddingBottom: px(cs.paddingBottom),
      borderRadius: px(cs.borderRadius),
      borderWidth: px(cs.borderTopWidth),
      borderColor: cs.borderTopColor,
      boxShadow: cs.boxShadow === 'none' ? '' : cs.boxShadow.slice(0, 60),
      width: px(r.width),
    });
  }

  // 品牌文案残留
  const body = document.body.innerText || '';
  const brandHits = {};
  for (const w of ['同橙', 'OPC Store', 'OPC社区', 'OPC 社区', 'opcstore', '集智']) {
    const n = (body.match(new RegExp(w.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'g')) || []).length;
    if (n) brandHits[w] = n;
  }
  const logoText = Array.from(root.querySelectorAll('.logo, .logo-a, [class*="logo"]'))
    .map(e => e.textContent.trim()).filter(Boolean).slice(0, 6);

  // 标题
  const headings = Array.from(root.querySelectorAll('h1,h2,h3,h4,h5'))
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
    .slice(0, 40).map(e => {
      const cs = getComputedStyle(e);
      return {
        tag: e.tagName.toLowerCase(),
        text: (e.textContent || '').trim().slice(0, 30),
        fontSize: px(cs.fontSize),
        fontWeight: cs.fontWeight,
        color: cs.color,
        marginTop: px(cs.marginTop),
        marginBottom: px(cs.marginBottom),
      };
    });

  return {
    title: document.title,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    rootBg: getComputedStyle(root).backgroundColor,
    textNodes, headings, brandHits, logoText,
    count: textNodes.length,
    docHeight: document.documentElement.scrollHeight,
  };
})()`;

/* ── 主流程 ───────────────────────────────────────────────────────────── */
const browserWsUrl = await wsUrl();
const client = connect(browserWsUrl);
await client.ready;

const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });

await client.send('Page.enable', {}, sessionId);
await client.send('Runtime.enable', {}, sessionId);
await client.send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
}, sessionId);

if (SHOTS) mkdirSync(OUT, { recursive: true });

const results = [];
for (const page of PAGES) {
  const url = BASE + page.path;
  try {
    await client.send('Page.navigate', { url }, sessionId);
    await sleep(2600);
    const { result } = await client.send('Runtime.evaluate', {
      expression: COLLECT, returnByValue: true,
    }, sessionId);
    const data = result.value;
    if (!data) { results.push({ path: page.path, label: page.label, error: '采集返回空' }); continue; }

    if (SHOTS) {
      const { data: png } = await client.send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: false,
      }, sessionId);
      writeFileSync(resolve(OUT, `${page.path.replace(/[/?=&]/g, '_')}.png`), Buffer.from(png, 'base64'));
    }
    results.push({ path: page.path, label: page.label, ...data });
    console.log(`✓ ${page.label.padEnd(10)} ${page.path.padEnd(28)} 文本节点 ${String(data.count).padStart(4)}  标题 ${data.headings.length}  品牌残留 ${JSON.stringify(data.brandHits)}`);
  } catch (error) {
    results.push({ path: page.path, label: page.label, error: error.message });
    console.log(`✗ ${page.label.padEnd(10)} ${page.path.padEnd(28)} ${error.message}`);
  }
}

writeFileSync(resolve(process.cwd(), '.screenshots/opc-design-baseline.json'), JSON.stringify(results, null, 2));

/* ── 汇总分析 ─────────────────────────────────────────────────────────── */
const ok = results.filter((r) => r.textNodes);
console.log('\n════════ 视觉体系基线分析 ════════');

// 1. 字号档位
const sizes = new Map();
for (const r of ok) for (const t of r.textNodes) sizes.set(t.fontSize, (sizes.get(t.fontSize) || 0) + 1);
console.log('\n【字体体系】字号档位分布（档位越多，层级越碎）');
console.log('  档位数:', sizes.size, '| 分布:', [...sizes.entries()].sort((a,b)=>a[0]-b[0]).map(([s,n])=>`${s}px×${n}`).join(' '));

// 字号阶之外的元素 —— 只给数字没法收口，必须点名是谁。
const SCALE = new Set([12, 13, 15, 19, 24, 32, 40, 48]);
const tail = new Map();
for (const r of ok) for (const t of r.textNodes) {
  if (SCALE.has(t.fontSize)) continue;
  const first = (t.cls || '(无类名)').split(/\s+/)[0];
  const key = `${String(t.fontSize).padStart(5)}px  ${t.tag}.${first}`;
  tail.set(key, (tail.get(key) || 0) + 1);
}
console.log('  字号阶之外（Top 15，按出现次数）:');
for (const [k, n] of [...tail.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`    ${String(n).padStart(4)}×  ${k}`);
}

// 尾巴元素多且分散时，光看「tag.class」还是定位不到 —— 补上样例文本与出现页面。
const tailDetail = new Map();
for (const r of ok) for (const t of r.textNodes) {
  if (SCALE.has(t.fontSize)) continue;
  const first = (t.cls || '(无类名)').split(/\s+/)[0];
  const key = `${String(t.fontSize).padStart(5)}px  ${t.tag}.${first}`;
  if (!tailDetail.has(key)) tailDetail.set(key, { n: 0, pages: new Map(), samples: [] });
  const d = tailDetail.get(key);
  d.n++;
  d.pages.set(r.label || r.path, (d.pages.get(r.label || r.path) || 0) + 1);
  if (d.samples.length < 2 && t.text) d.samples.push(t.text.slice(0, 18));
}
console.log('\n  尾巴元素明细（页数 / 样例文本）:');
for (const [k, n] of [...tail.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  const d = tailDetail.get(k);
  const pages = [...d.pages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([p, c]) => `${p}(${c})`).join(' ');
  console.log(`    ${k}\n        出现于 ${d.pages.size} 页：${pages}\n        样例：${d.samples.join(' / ')}`);
}

const weights = new Map();
for (const r of ok) for (const t of r.textNodes) weights.set(t.fontWeight, (weights.get(t.fontWeight) || 0) + 1);
console.log('  字重档位:', weights.size, '|', [...weights.entries()].sort((a,b)=>+b[1]-+a[1]).map(([w,n])=>`${w}×${n}`).join(' '));

const families = new Map();
for (const r of ok) for (const t of r.textNodes) families.set(t.fontFamily, (families.get(t.fontFamily) || 0) + 1);
console.log('  字体家族:', families.size, '|', [...families.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([f,n])=>`${f}×${n}`).join(' '));

// 2. 配色
const colors = new Map();
for (const r of ok) for (const t of r.textNodes) colors.set(t.color, (colors.get(t.color) || 0) + 1);
console.log('\n【配色】文字色档位:', colors.size, '| Top:', [...colors.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([c,n])=>`${c}×${n}`).join(' '));

const bgs = new Map();
for (const r of ok) for (const t of r.textNodes) if (t.bg && t.bg !== 'rgba(0, 0, 0, 0)') bgs.set(t.bg, (bgs.get(t.bg) || 0) + 1);
console.log('  背景色档位:', bgs.size, '| Top:', [...bgs.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([c,n])=>`${c}×${n}`).join(' '));

// 3. 间距
const pads = new Map();
for (const r of ok) for (const t of r.textNodes) pads.set(t.padding, (pads.get(t.padding) || 0) + 1);
console.log('\n【间距栅格】padding 组合数:', pads.size, '| Top:', [...pads.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([p,n])=>`${p}×${n}`).join(' '));

const margins = new Map();
for (const r of ok) for (const t of r.textNodes) margins.set(t.marginTop, (margins.get(t.marginTop) || 0) + 1);
console.log('  margin-top 档位:', margins.size, '| Top:', [...margins.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([m,n])=>`${m}×${n}`).join(' '));

// 4. 组件
const radii = new Map();
for (const r of ok) for (const t of r.textNodes) radii.set(t.borderRadius, (radii.get(t.borderRadius) || 0) + 1);
console.log('\n【组件】圆角档位:', radii.size, '|', [...radii.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([x,n])=>`${x}px×${n}`).join(' '));

const shadows = new Map();
for (const r of ok) for (const t of r.textNodes) if (t.boxShadow) shadows.set(t.boxShadow, (shadows.get(t.boxShadow) || 0) + 1);
console.log('  阴影样式数:', shadows.size, '| 元素总数:', shadows.size ? [...shadows.values()].reduce((a,b)=>a+b,0) : 0);

// 5. 品牌残留汇总
const brandTotal = {};
for (const r of ok) for (const [w,n] of Object.entries(r.brandHits || {})) brandTotal[w] = (brandTotal[w]||0)+n;
console.log('\n【品牌文案】全站残留:', JSON.stringify(brandTotal));
const logoSet = new Set();
for (const r of ok) for (const l of (r.logoText||[])) logoSet.add(l);
console.log('  Logo 文本:', [...logoSet].join(' | '));

// 6. 标题层级
console.log('\n【视觉层级】各页 H1-H4 字号序列（前 6 页）');
for (const r of ok.slice(0, 6)) {
  const seq = r.headings.slice(0,8).map(h => `${h.tag}:${h.fontSize}`).join(' ');
  console.log(`  ${r.label.padEnd(8)} ${seq}`);
}

client.close();
chrome.kill();
console.log('\n基线数据已写入 .screenshots/opc-design-baseline.json');
