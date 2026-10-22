#!/usr/bin/env node
/**
 * 响应式审计器 —— 零依赖，驱动 headless Chrome（CDP over Node 内置 WebSocket）。
 *
 * 对每个页面 × 每个断点宽度：
 *   1. 设置设备指标（宽度 / DPR / 移动端标记）
 *   2. 加载页面，等待网络与动效稳定
 *   3. 测量：文档横向溢出、超出视口右缘的元素、字号过小的文本、触控目标过小
 *   4. 截图留证（仅在发现问题或指定宽度时保存）
 *
 * 用法：node scripts/responsive-audit.mjs [--base http://localhost:3111] [--shots]
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith('--base=')) || '--base=http://localhost:3111').slice(7);
const SHOTS = args.includes('--shots');
const OUT = resolve(process.cwd(), '.screenshots/responsive');
const PORTRAIT = 875;
const WIDTHS = [
  { w: 375, h: 812, dpr: 3, mobile: true, label: '375 移动' },
  { w: 768, h: 1024, dpr: 2, mobile: true, label: '768 平板' },
  { w: 1024, h: 800, dpr: 2, mobile: false, label: '1024 小笔电' },
  { w: 1440, h: 900, dpr: 1, mobile: false, label: '1440 桌面' },
];

const PAGES = [
  '/', '/about', '/about/history', '/about/audience', '/about/partners',
  '/agents', '/agents/feishu', '/market', '/market/demand-retail-ai-ops',
  '/academy', '/academy/courses/ai-ecommerce-basics', '/news', '/news/opc-salon-2026-10',
  '/empower/space', '/empower/traffic', '/apply', '/traffic', '/search',
];

/* ── 启动 headless Chrome ─────────────────────────────────────────────── */
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--hide-scrollbars', '--user-data-dir=/tmp/jz-responsive-profile',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch { /* 还没起来 */ }
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
      return new Promise((rs, rj) => pending.set(mid, { resolve: rs, reject: rj }));
    },
    on(method, fn) {
      if (!events.has(method)) events.set(method, []);
      events.get(method).push(fn);
    },
    close: () => ws.close(),
  };
}

/* ── 页面内测量脚本 ───────────────────────────────────────────────────── */
const MEASURE = `(() => {
  // ⚠️ 屏蔽 Next.js 的开发指示器浮层（dev-only，生产不存在）。
  // 它是深色小徽章，会盖在页面上，既污染像素采样，也可能被算成横向溢出。
  if (!document.getElementById('opc-audit-hide-devtools')) {
    const style = document.createElement('style');
    style.id = 'opc-audit-hide-devtools';
    style.textContent = 'nextjs-portal,next-route-announcer{display:none !important}';
    document.head.appendChild(style);
  }
  const de = document.documentElement;
  // ⚠️ 视口宽必须用 clientWidth（不含垂直滚动条），不能用 window.innerWidth。
  // innerWidth **包含**滚动条宽度，用它当阈值会整体放宽 ~15px，
  // 把真实溢出漏掉 —— 2026-10-22 实测：768 平板首页容器宽 788px，
  // 真实溢出 20px，但因为阈值取 innerWidth 被判成 0。
  const vw = de.clientWidth;
  const out = {
    vw,
    innerWidth: window.innerWidth,
    scrollWidth: de.scrollWidth,
    clientWidth: de.clientWidth,
    overflow: de.scrollWidth - de.clientWidth,
    offenders: [],
    tinyText: [],
    smallTargets: [],
    clippedText: [],
  };
  const label = (el) => (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string'
    ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '')).slice(0, 110);

  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    // 1) 超出视口右缘（排除明显被 overflow 裁剪的祖先）
    if (r.right > vw + 1) {
      let clipped = false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const pcs = getComputedStyle(p);
        if (pcs.overflowX !== 'visible') { clipped = true; break; }
      }
      if (!clipped) {
        out.offenders.push({ el: label(el), right: Math.round(r.right), w: Math.round(r.width) });
      }
    }

    // 2) 过小字号：只对**含中文**的文本判定（docs/06 §2.3 的豁免：
    //    拉丁品牌副标与纯数字序号允许 11px，中文正文一律 ≥12px）
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText) {
      const fs = parseFloat(cs.fontSize);
      const text = el.textContent.trim();
      const hasCJK = /[\u3400-\u9FFF\uF900-\uFAFF]/.test(text);
      if (fs < 12 && hasCJK) out.tinyText.push({ el: label(el), size: fs, text: text.slice(0, 24) });
    }

    // 3) 触控目标过小（移动端断点）
    if (window.__auditMobile) {
      const interactive = el.matches('a, button, [role="button"], input, select, textarea');
      // 排除三类误报：
      //  a) sr-only 的 skip-link（聚焦时才展开，本身不可见）
      //  b) 视觉隐藏的蜜罐 input（absolute h-0 w-0 overflow-hidden，用户看不见也点不到）
      //  c) 被 <label> 包裹的 checkbox（真正可点的是整行 label，勾选框本体只有 16px）
      // sr-only 元素（skip-link）在未聚焦时被压成 1×1，聚焦才展开 —— 不是真实触控目标
      const isSrOnly =
        (cs.position === 'absolute' && (cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath !== 'none')) ||
        (r.width <= 1 && r.height <= 1);
      // 视觉隐藏判定要**看祖先**：蜜罐 input 自身有尺寸，但被
      // 用 absolute h-0 w-0 overflow-hidden 的包裹层裁掉了，用户看不见也点不到。
      const isVisuallyHidden = (() => {
        for (let p = el; p && p !== document.body; p = p.parentElement) {
          const pcs = getComputedStyle(p);
          if (pcs.getPropertyValue('aria-hidden').trim() === 'true') return true;
          if (pcs.overflow === 'hidden' && (p.getBoundingClientRect().width <= 1 || p.getBoundingClientRect().height <= 1)) return true;
        }
        return false;
      })();
      const isLabelledCheckbox = el.matches('input[type="checkbox"]') && el.closest('label');
      // 判定阈值用 WCAG 2.2 SC 2.5.8 AA 的 24×24（不是 40px 惯例值）——
      // 24–32px 记为「偏小」但不算失败，避免把合格项报成问题
      if (interactive && el.offsetParent !== null && !isSrOnly && !isVisuallyHidden && !isLabelledCheckbox
          && (r.width < 24 || r.height < 24)) {
        out.smallTargets.push({ el: label(el), w: Math.round(r.width), h: Math.round(r.height),
          text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20) });
      }
    }

    // 4) 文本被裁切（单行 ellipsis 之外的硬裁）
    if (hasText && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis'
        && cs.overflowX === 'visible' && cs.whiteSpace === 'nowrap') {
      out.clippedText.push({ el: label(el), text: el.textContent.trim().slice(0, 24) });
    }
  }
  out.offenders = out.offenders.slice(0, 8);
  out.tinyText = out.tinyText.slice(0, 8);
  out.smallTargets = out.smallTargets.slice(0, 8);
  out.clippedText = out.clippedText.slice(0, 8);
  return out;
})()`;

async function main() {
  if (SHOTS) mkdirSync(OUT, { recursive: true });
  const url = await wsUrl();
  const cdp = connect(url);
  await cdp.ready;

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sessionId);

  await S('Page.enable');
  await S('Runtime.enable');

  const rows = [];
  for (const w of WIDTHS) {
    await S('Emulation.setDeviceMetricsOverride', {
      width: w.w, height: w.h, deviceScaleFactor: w.dpr, mobile: w.mobile,
    });
    for (const p of PAGES) {
      await S('Page.navigate', { url: BASE + p });
      await sleep(700);
      // 等字体与动效稳定
      await S('Runtime.evaluate', { expression: 'document.fonts ? document.fonts.ready : null', awaitPromise: true });
      await sleep(450);
      const r = await S('Runtime.evaluate', {
        expression: MEASURE.replace('window.__auditMobile', String(w.mobile)),
        returnByValue: true,
      });
      const m = r.result.value;
      const issues = [];
      if (m.overflow > 1) issues.push(`横向溢出 ${m.overflow}px`);
      if (m.offenders.length) issues.push(`越界元素 ${m.offenders.length}`);
      if (m.tinyText.length) issues.push(`字号<12px ${m.tinyText.length}`);
      if (m.smallTargets.length) issues.push(`触控目标<24px(AA) ${m.smallTargets.length}`);
      if (m.clippedText.length) issues.push(`文本硬裁 ${m.clippedText.length}`);

      rows.push({ page: p, width: w.w, label: w.label, ...m, issues });
      const mark = issues.length ? '❌' : '✅';
      console.log(`${mark} ${String(w.w).padStart(4)}px ${p.padEnd(34)} ${issues.join(' / ') || 'OK'}`);

      if (issues.length && SHOTS) {
        const shot = await S('Page.captureScreenshot', { format: 'png' });
        const name = `${String(w.w)}-${p.replace(/\//g, '_') || 'home'}.png`;
        writeFileSync(resolve(OUT, name), Buffer.from(shot.data, 'base64'));
      }
    }
  }

  const bad = rows.filter((r) => r.issues.length);
  writeFileSync(resolve(process.cwd(), '.screenshots/responsive-audit.json'), JSON.stringify(rows, null, 2));
  console.log(`\n═══ 汇总：${rows.length} 个组合（${PAGES.length} 页 × ${WIDTHS.length} 档），${bad.length} 个有问题 ═══`);
  for (const r of bad) {
    console.log(`\n── ${r.label} ${r.page}`);
    if (r.offenders.length) console.log('   越界:', JSON.stringify(r.offenders));
    if (r.tinyText.length) console.log('   小字:', JSON.stringify(r.tinyText));
    if (r.smallTargets.length) console.log('   小触控:', JSON.stringify(r.smallTargets));
    if (r.clippedText.length) console.log('   硬裁:', JSON.stringify(r.clippedText));
  }
  cdp.close();
  chrome.kill();
}

main().catch((e) => { console.error(e); chrome.kill(); process.exit(1); });
