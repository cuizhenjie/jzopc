#!/usr/bin/env node
/** 移动端顶栏截图：390x844 视口，抓 顶部浮态 / 抽屉打开 / 滚动后实底 三态。 */
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const base = process.argv.find(v => v.startsWith('--base='))?.slice(7) || 'http://127.0.0.1:3000';
const port = 9477;
const dir = await mkdtemp(path.join(tmpdir(), 'jizhi-mnav-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--hide-scrollbars',
  `--user-data-dir=${dir}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

try {
  let endpoint;
  for (let i = 0; i < 60 && !endpoint; i++) {
    try { endpoint = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; }
    catch { await sleep(200); }
  }
  const socket = new WebSocket(endpoint);
  await new Promise(r => socket.addEventListener('open', r, { once: true }));
  let seq = 0;
  const pending = new Map();
  socket.addEventListener('message', e => {
    const r = JSON.parse(e.data);
    const t = pending.get(r.id);
    if (t) { pending.delete(r.id); r.error ? t.reject(new Error(r.error.message)) : t.resolve(r.result); }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  });

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => send(m, p, sessionId);
  await S('Page.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await S('Emulation.setTouchEmulationEnabled', { enabled: true });

  const shot = async name => {
    const { data } = await S('Page.captureScreenshot', { format: 'png' });
    const { writeFile } = await import('node:fs/promises');
    await writeFile(path.join(dir, name), Buffer.from(data, 'base64'));
    console.log(name, '→', path.join(dir, name));
  };

  await S('Page.navigate', { url: `${base}/?noanim` });
  await sleep(2500);
  await shot('1-hero-float.png');

  // 打开抽屉
  await S('Runtime.evaluate', { expression: `document.querySelector('.burger').click()` });
  await sleep(600);
  await shot('2-drawer-open.png');

  // 关抽屉并滚动到实底态
  await S('Runtime.evaluate', { expression: `document.querySelector('.burger').click()` });
  await sleep(300);
  await S('Runtime.evaluate', { expression: `window.scrollTo({top: 900})` });
  await sleep(800);
  await shot('3-scrolled-solid.png');

  // 抽屉在半屏滚动后的表现（复测 z-index / 背景）
  await S('Runtime.evaluate', { expression: `document.querySelector('.burger').click()` });
  await sleep(600);
  await shot('4-drawer-scrolled.png');

  chrome.kill();
  process.exit(0);
} catch (error) {
  console.error(error);
  chrome.kill();
  process.exit(1);
}
