#!/usr/bin/env node
/** Real Chrome checks for the new motion lifecycle, geometry and navigation breakpoint.
 * Run against an existing preview: node scripts/opc-motion-audit.mjs --base=http://127.0.0.1:3134
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const base = process.argv.find(value => value.startsWith('--base='))?.slice(7) || 'http://127.0.0.1:3134';
const port = 9481;
const directory = await mkdtemp(path.join(tmpdir(), 'jizhi-motion-'));
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', `--remote-debugging-port=${port}`, '--no-first-run', '--no-default-browser-check',
  '--hide-scrollbars', `--user-data-dir=${directory}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const checks = [];
let socket;
try {
  let endpoint;
  for (let attempt = 0; attempt < 60 && !endpoint; attempt++) {
    try { endpoint = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()).webSocketDebuggerUrl; }
    catch { await sleep(200); }
  }
  assert.ok(endpoint, 'Independent Chrome did not start');
  socket = new WebSocket(endpoint);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener('message', event => {
    const response = JSON.parse(event.data);
    const task = pending.get(response.id);
    if (!task) return;
    pending.delete(response.id);
    response.error ? task.reject(new Error(response.error.message)) : task.resolve(response.result);
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const S = (method, params) => send(method, params, sessionId);
  const evaluate = async expression => {
    const response = await S('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  const until = async (expression, message) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await sleep(150);
    }
    throw new Error(message);
  };
  const check = (name, detail) => { checks.push({ name, detail, passed: true }); console.log(`PASS ${name}`); };
  const state = () => evaluate(`(() => {const carousel=document.querySelector('.hero-carousel');return {index:Number(carousel.dataset.opcSlide),playing:carousel.dataset.opcAutoplay==='true',reason:carousel.dataset.opcPauseReason,controls:document.querySelectorAll('.opc-carousel-controls').length}})()`);
  const media = value => S('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] });
  const go = async () => {
    const result = await S('Page.navigate', { url: base + '/' });
    assert.ok(!result.errorText, result.errorText);
    await until("document.readyState==='complete'&&document.querySelectorAll('.opc-carousel-dot').length===4", 'Current preview did not hydrate the motion controls');
    await sleep(200);
  };
  await S('Page.enable'); await S('Runtime.enable');
  await S('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await media('no-preference');
  await go();

  // The captured Vue offsets must not survive on the second, third or fourth slide.
  for (let index = 0; index < 4; index++) {
    await evaluate(`document.querySelectorAll('.opc-carousel-dot')[${index}].click()`);
    await sleep(750);
    const geometry = await evaluate(`(() => {const active=document.querySelector('.el-carousel__item.is-active'),r=active.getBoundingClientRect();return {transform:getComputedStyle(active).transform,left:r.left,width:r.width,opacity:getComputedStyle(active).opacity,inactive:[...document.querySelectorAll('.el-carousel__item:not(.is-active)')].every(e=>e.inert&&e.getAttribute('aria-hidden')==='true'),activeHidden:active.getAttribute('aria-hidden')}})()`);
    assert.equal(geometry.transform, 'none'); assert.ok(Math.abs(geometry.left) < 2); assert.ok(geometry.width > 1400);
    assert.equal(geometry.opacity, '1'); assert.equal(geometry.inactive, true); assert.equal(geometry.activeHidden, 'false');
  }
  check('all four slides render within the viewport and inactive panels are inert');
  assert.equal((await state()).controls, 1);
  check('Strict Mode setup leaves one control group');

  await evaluate("document.querySelector('.opc-carousel-dot').focus()");
  await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End' });
  assert.equal((await state()).index, 4); assert.ok((await state()).reason.includes('focus'));
  assert.equal(await evaluate("document.activeElement.id"), 'opc-hero-tab-4');
  await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Home', code: 'Home' });
  assert.equal((await state()).index, 1);
  check('keyboard Home/End move selection and focus, with autoplay paused');

  await evaluate("document.querySelector('.opc-carousel-toggle').click();document.querySelector('.opcheader a').focus()");
  assert.ok((await state()).reason.includes('user'));
  await evaluate("document.querySelector('.opc-carousel-toggle').click()");
  await until("document.querySelector('.hero-carousel').dataset.opcAutoplay==='true'", 'Autoplay did not resume');
  const automatic = (await state()).index;
  await sleep(5850);
  assert.notEqual((await state()).index, automatic);
  check('explicit pause persists until resumed and normal autoplay advances');

  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 400, y: 600 });
  await until("document.querySelector('.hero-carousel').dataset.opcPauseReason.includes('hover')", 'Pointer hover did not pause');
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: -10, y: -10 });
  check('real pointer entry pauses autoplay');

  await media('reduce');
  await until("document.querySelector('.hero-carousel').dataset.opcPauseReason.includes('reduced-motion')", 'Changing system preference did not pause');
  const reduced = (await state()).index;
  await sleep(5850);
  assert.equal((await state()).index, reduced);
  assert.equal(await evaluate("document.querySelectorAll('[data-opc-reveal=\"pending\"]').length"), 0);
  await media('no-preference');
  check('runtime reduced-motion change pauses actual playback and reveals all content');

  await evaluate('window.scrollTo(0,1800)');
  await until("document.querySelector('.hero-carousel').dataset.opcPauseReason.includes('offscreen')", 'Offscreen hero did not pause');
  const offscreen = (await state()).index;
  await sleep(5850);
  assert.equal((await state()).index, offscreen);
  await evaluate('window.scrollTo(0,0)');
  await until("!document.querySelector('.hero-carousel').dataset.opcPauseReason.includes('offscreen')", 'Hero stayed offscreen after return');
  check('offscreen playback stays stopped through a full autoplay period');

  const other = await send('Target.createTarget', { url: 'about:blank', background: false });
  const otherSession = await send('Target.attachToTarget', { targetId: other.targetId, flatten: true });
  await send('Page.bringToFront', {}, otherSession.sessionId);
  await until("document.hidden&&document.querySelector('.hero-carousel').dataset.opcPauseReason.includes('background')", 'Background tab did not publish its paused state');
  await send('Target.closeTarget', { targetId: other.targetId }); await S('Page.bringToFront');
  await until("!document.hidden&&!document.querySelector('.hero-carousel').dataset.opcPauseReason.includes('background')", 'Foreground state did not recover');
  check('real tab visibility changes stop and recover playback');

  for (const width of [375, 768, 1024, 1100, 1200, 1279, 1280, 1440]) {
    await S('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(180);
    const navigation = await evaluate(`(() => {const nav=document.querySelector('.nav-links'),menu=document.querySelector('.mobile-menu');return{display:getComputedStyle(nav).display,direction:getComputedStyle(nav).flexDirection,menu:getComputedStyle(menu).display,overflow:document.documentElement.scrollWidth-innerWidth}})()`);
    assert.equal(navigation.overflow, 0, `Horizontal overflow at ${width}`);
    if (width < 1280) {
      assert.equal(navigation.display, 'none', `Menu was expanded at ${width}`); assert.notEqual(navigation.menu, 'none');
      await evaluate("document.querySelector('.mobile-menu').click()");
      await until("document.querySelector('.mobile-menu').getAttribute('aria-expanded')==='true'", 'Menu did not open');
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.nav-links')).display"), 'flex');
      await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.nav-links')).display"), 'none');
    } else { assert.equal(navigation.display, 'flex'); assert.equal(navigation.direction, 'row'); assert.equal(navigation.menu, 'none'); }
    check(`navigation breakpoint ${width}px`, navigation);
  }

  // Disable page scripts before navigation: the document must remain complete.
  await S('Emulation.setScriptExecutionDisabled', { value: true });
  await S('Page.navigate', { url: base + '/' });
  await sleep(1300);
  assert.equal(await evaluate("document.querySelectorAll('[data-opc-reveal=\"pending\"]').length"), 0);
  assert.ok(await evaluate("!!document.querySelector('h1')&&document.documentElement.scrollHeight>3000"));
  check('no-JavaScript SSR content stays visible');
  await mkdir('.screenshots', { recursive: true });
  await writeFile('.screenshots/opc-motion-audit.json', JSON.stringify({ base, checks }, null, 2));
  console.log(`${checks.length} browser motion checks passed`);
} finally {
  socket?.close();
  chrome.kill();
}
