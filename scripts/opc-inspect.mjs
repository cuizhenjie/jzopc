#!/usr/bin/env node
/**
 * OPC 复刻站 · 元素诊断（零依赖，CDP over Node 内置 WebSocket）
 *
 * ## 用途
 *
 * 对比度实测只会告诉你「某个文字元素的对比度不达标」，
 * 但**不会**告诉你它为什么是这个颜色、背后那层底是谁画的。
 * 这个脚本补上那一段：给一个路径 + 一段文本（或 CSS 选择器），
 * 打印出元素的祖先链，每一层各自的 `background-color` / `background-image`，
 * 以及最终生效的 `color` / `font-size`。
 *
 * 典型用法（排查「声明正确但计算值不符」这类层叠问题）：
 *
 * ```bash
 * node scripts/opc-inspect.mjs --path=/ --text=集智AI
 * node scripts/opc-inspect.mjs --path=/zone?city=上海 --sel=.opc-name
 * ```
 *
 * 输出里 `▸` 标记的元素就是命中的那个，`▲` 标记的是第一个带背景的祖先。
 */
import { spawn } from 'node:child_process';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9411;
const args = process.argv.slice(2);
const argOf = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : '';
};
const BASE = argOf('base') || 'http://localhost:3000';
const PATH = argOf('path') || '/';
const TEXT = argOf('text');
const SEL = argOf('sel');
const WIDTH = Number(argOf('width') || 1440);
const HEIGHT = Number(argOf('height') || 900);
/** 是否对命中元素做像素抽样（判断对比度失败是真问题还是采样误判） */
const SHOT = args.includes('--shot');

if (!TEXT && !SEL) {
  console.error('用法：node scripts/opc-inspect.mjs --path=/ [--text=片段 | --sel=选择器] [--width=1440]');
  process.exit(1);
}

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
  '--no-default-browser-check', '--hide-scrollbars',
  '--user-data-dir=/tmp/jz-inspect', 'about:blank',
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

const PROBE = `(() => {
  const root = document.querySelector('.opc-replica');
  if (!root) return { error: 'no replica root' };

  const brief = (el) => {
    const s = getComputedStyle(el);
    const cls = String(el.className || '').trim().split(/\\s+/).filter(Boolean).slice(0, 3).join('.');
    return {
      tag: el.tagName.toLowerCase(),
      cls,
      id: el.id || undefined,
      color: s.color,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      bgColor: s.backgroundColor,
      bgImage: s.backgroundImage === 'none' ? undefined : s.backgroundImage.slice(0, 120),
      bgClip: s.webkitBackgroundClip || s.backgroundClip,
      textFill: s.webkitTextFillColor,
      opacity: s.opacity,
    };
  };

  const hits = [];
  if (${JSON.stringify(SEL)}) {
    for (const el of document.querySelectorAll(${JSON.stringify(SEL)})) hits.push(el);
  } else {
    const needle = ${JSON.stringify(TEXT)};
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.textContent.trim().includes(needle) && n.parentElement) hits.push(n.parentElement);
    }
  }

  const out = [];
  for (const el of hits.slice(0, 6)) {
    const chain = [];
    let cur = el;
    for (let i = 0; cur && i < 8 && cur.nodeType === 1; i++, cur = cur.parentElement) {
      chain.push(brief(cur));
    }
    const r = el.getBoundingClientRect();
    out.push({
      chain,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      pageRect: {
        x: Math.round(r.x + window.scrollX), y: Math.round(r.y + window.scrollY),
        w: Math.round(r.width), h: Math.round(r.height),
      },
      html: el.outerHTML.slice(0, 260),
    });
  }
  return { hits: out.length, items: out };
})()`;

const client = await connect(await wsUrl());
await client.ready;
const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });

await client.send('Page.enable', {}, sessionId);
await client.send('Runtime.enable', {}, sessionId);
await client.send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false,
}, sessionId);
await client.send('Page.navigate', { url: BASE + PATH }, sessionId);
await sleep(2500);

const { result, exceptionDetails } = await client.send('Runtime.evaluate', {
  expression: PROBE, returnByValue: true, awaitPromise: true,
}, sessionId);

if (exceptionDetails) {
  console.error('页面内异常：', exceptionDetails.text, exceptionDetails.exception?.description || '');
} else {
  const data = result.value;
  if (data?.error) console.error('探测失败：', data.error);
  else {
    console.log(`\n路径 ${PATH}　视口 ${WIDTH}×${HEIGHT}　命中 ${data.hits} 处\n`);
    for (const item of data.items) {
      console.log('────────────────────────────────────────────────────────');
      console.log('HTML:', item.html);
      console.log('Rect:', JSON.stringify(item.rect));
      item.chain.forEach((c, i) => {
        const mark = i === 0 ? '▸' : (c.bgColor !== 'rgba(0, 0, 0, 0)' || c.bgImage ? '▲' : ' ');
        const bg = c.bgImage ? c.bgImage : c.bgColor;
        console.log(`${mark} ${String(i).padStart(2)} ${c.tag}${c.id ? '#' + c.id : ''}${c.cls ? '.' + c.cls : ''}`);
        console.log(`      color=${c.color} size=${c.fontSize} weight=${c.fontWeight} opacity=${c.opacity}`);
        console.log(`      bg=${bg}`);
        if (c.bgClip === 'text') console.log(`      ⚠ background-clip:text（渐变文字）textFill=${c.textFill}`);
      });

      // ── 像素抽样：把命中区域真实截下来，取色彩分布 ──
      // 这一步是判断「对比度失败是真问题还是采样误判」的关键：
      // 计算色 ≠ 绘制色的场景（渐变文字 / 半透明白字）只有看像素才能分辨。
      if (SHOT) {
        const first = data.items[0];
        await client.send('Runtime.evaluate', {
          // ⚠️ 必须 instant：主站 globals.css 有 scroll-behavior:smooth，
          // 默认平滑滚动会让截图落点与 DOM rect 落在不同位置。
          expression: `window.scrollTo({ top: Math.max(0, ${first.pageRect.y} - 120), behavior: 'instant' });`,
        }, sessionId);
        await sleep(500);
        const box = await client.send('Runtime.evaluate', {
          expression: `(() => {
            const root = document.querySelector('.opc-replica');
            const needle = ${JSON.stringify(TEXT)};
            const sel = ${JSON.stringify(SEL)};
            let el = null;
            if (sel) el = document.querySelector(sel);
            else {
              const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
              let n;
              while ((n = w.nextNode())) if (n.textContent.trim().includes(needle)) { el = n.parentElement; break; }
            }
            if (!el) return null;
            // ⚠️ captureBeyondViewport:false 时 clip 按**视口坐标**解释，
            // 用页面坐标会截到视口之外的空白区（表现为一张纯色小图）。
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          })()`,
          returnByValue: true,
        }, sessionId);
        const clip = box.result?.value;
        if (clip) {
          // ⚠️ captureBeyondViewport:true 会先把整页渲染出来再裁剪，
          // 长页面上 base64 会大到 JSON.stringify 直接抛 "Invalid string length"。
          // 因此只截视口内区域（元素已滚动到视口内）。
          const { data: png } = await client.send('Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: false,
            clip: { x: clip.x, y: clip.y, width: Math.max(clip.width, 8), height: Math.max(clip.height, 8), scale: 1 },
          }, sessionId);
          if (png && png.length > 8_000_000) throw new Error('截图过大：' + png.length);
          await client.send('Runtime.evaluate', {
            expression: `window.__opcShot = ${JSON.stringify(`data:image/png;base64,${png}`)};`,
          }, sessionId);
          const { result: colors } = await client.send('Runtime.evaluate', {
            expression: `(async () => {
              const img = new Image();
              img.src = window.__opcShot;
              await img.decode();
              const c = document.createElement('canvas');
              c.width = img.naturalWidth; c.height = img.naturalHeight;
              const ctx = c.getContext('2d', { willReadFrequently: true });
              ctx.drawImage(img, 0, 0);
              const d = ctx.getImageData(0, 0, c.width, c.height).data;
              const buckets = new Map();
              for (let i = 0; i < d.length; i += 4) {
                const k = ((d[i] >> 3) << 10) | ((d[i+1] >> 3) << 5) | (d[i+2] >> 3);
                const b = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
                b.n++; b.r += d[i]; b.g += d[i+1]; b.b += d[i+2];
                buckets.set(k, b);
              }
              return [...buckets.values()]
                .sort((a, b) => b.n - a.n).slice(0, 8)
                .map((b) => ({
                  rgb: 'rgb(' + Math.round(b.r / b.n) + ', ' + Math.round(b.g / b.n) + ', ' + Math.round(b.b / b.n) + ')',
                  pct: Math.round((b.n / (c.width * c.height)) * 1000) / 10,
                }));
            })()`,
            returnByValue: true, awaitPromise: true,
          }, sessionId);
          console.log('  像素分布：', (colors.result?.value || []).map((x) => `${x.rgb} ${x.pct}%`).join('　|　'));
        }
      }
    }
  }
}

client.close();
chrome.kill();
process.exit(0);
