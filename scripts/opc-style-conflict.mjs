#!/usr/bin/env node
/**
 * OPC 复刻站 · 样式覆盖冲突检测（零依赖，CDP over Node 内置 WebSocket）
 *
 * ## 为什么需要这个
 *
 * CSS Cascade 规定：**带 `!important` 的声明先于不带 `!important` 的生效**，
 * 且这一步发生在特异性比较之前。
 *
 * 复刻页的设计层（`src/styles/opc-*.css`）为了压过原站的机器改色 CSS，
 * 大量使用了 `!important`；而原站 CSS 的规则**不带** `!important`。
 * 于是产生一个反直觉的后果：
 *
 *   设计层 `.opc-replica.opc-replica .hero-stat-num { color:#fff !important }`
 *   原站   `.opc-replica .hero .hero-stats-row .hero-stat .hero-stat-num[data-v-x] { color:#fff }`
 *
 * 设计层特异性 (0,3,0) 远低于原站 (0,6,0)，但因为带 `!important`，
 * **设计层反而赢了** —— 这正是我们想要的。
 *
 * 风险在于反向：当**原站**的某条规则带了 `!important`（机器改色脚本不会加，
 * 但原站 CSS 里存在内联 style 与部分 `!important`），或当设计层某条规则
 * **漏了** `!important` 而原站那条带 `!important` 时，设计层就会失效。
 *
 * 本脚本实测每个页面上「设计层声明了、但计算值与声明不符」的元素，
 * 把这类静默失效全部找出来。
 *
 * 用法：node scripts/opc-style-conflict.mjs [--base http://localhost:3000]
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9395;
const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith('--base=')) || '--base=http://localhost:3000').slice(7);

const PAGES = [
  '/', '/about', '/agent', '/market', '/center', '/starproject',
  '/community', '/work', '/computingresource', '/newslist',
  '/activitylist', '/newsdetail?id=392', '/nanjingzone', '/zone?city=上海',
  '/starjoin', '/opcapply?formType=training', '/opclogin', '/opcregister',
];

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
  '--no-default-browser-check', '--hide-scrollbars',
  '--user-data-dir=/tmp/jz-style-conflict', 'about:blank',
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
 * 页面内脚本：找出「设计层声明了某个属性，但元素计算值与之不符」的情况。
 * 判定方式：对每个元素，取所有匹配它的规则里**最后一条带 !important 的**
 * 声明作为「设计层期望值」，与 computed 对比。
 */
const CHECK = `(() => {
  const root = document.querySelector('.opc-replica');
  if (!root) return { error: 'no replica root' };

  // 收集所有样式表的规则（按文档顺序 = 层叠顺序）
  const sheets = [];
  for (const ss of document.styleSheets) {
    let rules;
    try { rules = ss.cssRules; } catch { continue; }
    sheets.push({ href: ss.href || 'inline', rules });
  }

  const collect = (rules, href, out) => {
    for (const r of rules) {
      if (r.cssRules) { collect(r.cssRules, href, out); continue; }
      if (!r.selectorText) continue;
      out.push({ href, rule: r });
    }
  };
  const all = [];
  for (const s of sheets) collect(s.rules, s.href, all);

  const isDesign = (href) => href.includes('/app/page.css') || href.includes('/app/layout.css') && href.includes('opc');
  const isReference = (href) => href.includes('reference-blue.css');

  const issues = [];
  const elements = root.querySelectorAll('*');
  for (const el of elements) {
    if (el.children.length) continue; // 只看叶子节点（直接承载文字/背景的）
    const text = (el.textContent || '').trim();
    const hasText = text.length > 0 && text.length < 200;
    const style = el.getAttribute('style') || '';
    if (!hasText && !style) continue;

    const computed = getComputedStyle(el);

    // 找出所有匹配且带 !important 的声明（后出现的覆盖先出现的）
    const wanted = {};
    const sources = {};
    for (const { href, rule } of all) {
      let matches = false;
      try { matches = el.matches(rule.selectorText); } catch { continue; }
      if (!matches) continue;
      const decl = rule.style;
      for (const prop of ['color', 'font-size', 'background-color', 'border-radius', 'font-weight']) {
        const v = decl.getPropertyValue(prop);
        if (!v) continue;
        const pri = decl.getPropertyPriority(prop);
        if (pri !== 'important') continue;
        wanted[prop] = v;
        sources[prop] = href;
      }
    }
    if (!Object.keys(wanted).length) continue;

    for (const [prop, expected] of Object.entries(wanted)) {
      const actual = computed[prop];
      if (!actual || !expected) continue;
      // 归一化比较：把期望值尽量转成计算值格式
      let norm = expected.trim();
      const m = norm.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      if (m) {
        let hex = m[1];
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
        norm = 'rgb(' + r + ', ' + g + ', ' + b + ')';
      }
      const pm = norm.match(/^rgba?\\(([^)]+)\\)$/);
      const am = actual.match(/^rgba?\\(([^)]+)\\)$/);
      if (pm && am) {
        const p = pm[1].split(',').map(s => s.trim());
        const a = am[1].split(',').map(s => s.trim());
        if (p[0] === a[0] && p[1] === a[1] && p[2] === a[2]) continue;
        // 带 alpha 的：alpha 不同也算不同（除非设计层写的是纯色且实际更透明）
        if (p[3] === undefined && a[3] === '0') continue;
      } else if (norm === actual) {
        continue;
      } else if (prop === 'font-size' && Math.abs(parseFloat(norm) - parseFloat(actual)) < 0.6) {
        continue;
      } else if (prop === 'border-radius' && Math.abs(parseFloat(norm) - parseFloat(actual)) < 0.6) {
        continue;
      } else if (prop === 'font-weight' && String(parseInt(norm)) === String(parseInt(actual))) {
        continue;
      }
      issues.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 60),
        text: text.slice(0, 26),
        prop,
        expected: norm,
        actual,
        from: (sources[prop] || '').split('/').pop(),
      });
    }
  }

  // 同一 selector+prop 只报一次
  const seen = new Set();
  const unique = issues.filter(i => {
    const k = i.cls + '|' + i.prop + '|' + i.expected;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { count: unique.length, issues: unique.slice(0, 60) };
})()`;

const client = connect(await wsUrl());
await client.ready;
const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });
await client.send('Page.enable', {}, sessionId);
await client.send('Runtime.enable', {}, sessionId);
await client.send('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
}, sessionId);

const report = [];
let total = 0;
for (const path of PAGES) {
  await client.send('Page.navigate', { url: BASE + path }, sessionId);
  await sleep(2600);
  const { result } = await client.send('Runtime.evaluate', {
    expression: CHECK, returnByValue: true,
  }, sessionId);
  const data = result.value;
  if (!data || data.error) { console.log(`✗ ${path} ${data?.error ?? '返回空'}`); continue; }
  total += data.count;
  report.push({ path, ...data });
  console.log(`${data.count ? '✗' : '✓'} ${path.padEnd(30)} 冲突 ${data.count}`);
  if (data.count) {
    data.issues.slice(0, 6).forEach((i) => console.log(`     ${i.prop.padEnd(10)} 期望 ${String(i.expected).padEnd(22)} 实际 ${String(i.actual).padEnd(22)} .${i.cls.slice(0, 34)}`));
  }
}

writeFileSync(resolve(process.cwd(), '.screenshots/opc-style-conflicts.json'), JSON.stringify(report, null, 2));
console.log(`\n合计样式冲突：${total}`);
console.log('明细已写入 .screenshots/opc-style-conflicts.json');

client.close();
chrome.kill();
