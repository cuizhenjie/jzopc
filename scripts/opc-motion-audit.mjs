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
const startedAt = new Date().toISOString();
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
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
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
  await S('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__opcImageTiming = [];
    const originalDecode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function (...args) {
      const result = originalDecode.apply(this, args);
      return result.then(value => {
        if (this.closest('.hero-carousel')) window.__opcImageTiming.push({kind:'decode',src:this.getAttribute('src'),at:performance.now()});
        return value;
      });
    };
    new MutationObserver(records => records.forEach(record => {
      const image = record.target;
      if (image instanceof HTMLImageElement && image.closest('.hero-carousel') && image.loading === 'eager')
        window.__opcImageTiming.push({kind:'eager',src:image.getAttribute('src'),at:performance.now()});
    })).observe(document,{subtree:true,attributes:true,attributeFilter:['loading']});
  ` });
  await S('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await media('no-preference');
  await go();

  const firstImages = await evaluate("[...document.querySelectorAll('.hero-carousel img')].map(e=>({src:e.getAttribute('src'),loading:e.loading}))");
  assert.equal(firstImages[0].loading, 'eager');
  await until("document.querySelectorAll('.hero-carousel img')[1].loading==='eager'", 'Next frame did not warm after the first image');
  const imageTiming = await evaluate('window.__opcImageTiming');
  const decoded = imageTiming.find(event => event.kind === 'decode' && event.src === firstImages[0].src);
  const warmed = imageTiming.find(event => event.kind === 'eager' && event.src === firstImages[1].src);
  assert.ok(decoded && warmed && warmed.at - decoded.at >= 950, 'Next eager request must follow first-frame decode and its delay');
  check('next frame warms at least 950ms after first-frame decoding', { delay: Math.round(warmed.at - decoded.at) });

  for (const selector of ['.ftr-node', '.eco-node', '.strength-block']) {
    const target = await evaluate(`(() => {const e=document.querySelector('${selector}');return {present:!!e,pending:e?.dataset.opcReveal==='pending',top:e?.getBoundingClientRect().top}})()`);
    assert.ok(target.present && target.pending && target.top > 1000, `Actual homepage target ${selector} was not prepared`);
  }
  const galleries = await evaluate("[...document.querySelectorAll('.opc-visual-photo-card')].map(e=>({prepared:!!e.dataset.opcReveal,below:e.getBoundingClientRect().top>innerHeight+24}))");
  assert.ok(galleries.length > 0 && galleries.every(item => !item.below || item.prepared), 'Current photo-gallery cards did not participate in reveal');
  await evaluate("document.querySelector('.ftr-node').scrollIntoView({block:'center'})");
  await until("document.querySelector('.ftr-node').dataset.opcReveal==='shown'", 'Real feature node was not revealed on entry');
  await until("getComputedStyle(document.querySelector('.ftr-node')).opacity==='1'", 'Feature reveal did not finish');
  await evaluate('window.scrollTo(0,0)');
  check('actual homepage feature, ecosystem and strength nodes participate in progressive reveal');

  // The captured Vue offsets must not survive on the second, third or fourth slide.
  const slideGeometry = [];
  for (let index = 0; index < 4; index++) {
    await evaluate(`document.querySelectorAll('.opc-carousel-dot')[${index}].click()`);
    await until("(()=>{const i=document.querySelector('.el-carousel__item.is-active img');return i.complete&&i.naturalWidth>0})()", 'Selected hero image failed to load');
    await until("getComputedStyle(document.querySelector('.el-carousel__item.is-active')).opacity==='1'", 'Selected hero frame did not finish its transition');
    const geometry = await evaluate(`(() => {const active=document.querySelector('.el-carousel__item.is-active'),r=active.getBoundingClientRect(),i=active.querySelector('img');return {transform:getComputedStyle(active).transform,left:r.left,width:r.width,opacity:getComputedStyle(active).opacity,image:i.currentSrc,naturalWidth:i.naturalWidth,inactive:[...document.querySelectorAll('.el-carousel__item:not(.is-active)')].every(e=>e.inert&&e.getAttribute('aria-hidden')==='true'),activeHidden:active.getAttribute('aria-hidden')}})()`);
    assert.equal(geometry.transform, 'none'); assert.ok(Math.abs(geometry.left) < 2); assert.ok(geometry.width > 1400);
    assert.equal(geometry.opacity, '1'); assert.equal(geometry.inactive, true); assert.equal(geometry.activeHidden, 'false');
    slideGeometry.push(geometry);
  }
  check('all four loaded slides render within the viewport and inactive panels are inert', slideGeometry);
  assert.equal((await state()).controls, 1);
  check('Strict Mode setup leaves one control group');

  await evaluate("document.querySelector('.opc-carousel-dot').focus()");
  await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End' });
  assert.equal((await state()).index, 4); assert.ok((await state()).reason.includes('focus'));
  assert.equal(await evaluate("document.activeElement.id"), 'opc-hero-tab-4');
  await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Home', code: 'Home' });
  assert.equal((await state()).index, 1);
  check('keyboard Home/End move selection and focus, with autoplay paused');

  await evaluate("document.querySelector('.opcheader a').focus();document.querySelector('.opc-carousel-toggle').click()");
  assert.ok((await state()).reason.includes('user'));
  await evaluate("document.querySelector('.opc-carousel-toggle').click()");
  await until("document.querySelector('.hero-carousel').dataset.opcAutoplay==='true'", 'Autoplay did not resume');
  const automatic = (await state()).index;
  await sleep(5850);
  assert.notEqual((await state()).index, automatic);
  check('explicit pause persists until resumed and normal autoplay advances');

  await S('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const tapRotation = async () => {
    const point = await evaluate("(()=>{const r=document.querySelector('.opc-carousel-toggle').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
    await S('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await sleep(80);
    await S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(120);
  };
  assert.equal((await state()).playing, true);
  await tapRotation();
  assert.ok((await state()).reason.includes('user'), 'First real tap of visible Pause must pause, despite contact/focus events');
  assert.equal(await evaluate("document.activeElement.classList.contains('opc-carousel-toggle')"), true);
  const touchPaused = (await state()).index;
  await sleep(5850);
  assert.equal((await state()).index, touchPaused);
  await tapRotation();
  assert.equal((await state()).playing, true, 'Second real tap must resume while the button retains focus');
  assert.equal(await evaluate("document.activeElement.classList.contains('opc-carousel-toggle')"), true);
  await sleep(5850);
  assert.notEqual((await state()).index, touchPaused);
  await evaluate("document.querySelector('.opcheader a').focus()");
  check('first real touch tap pauses; second resumes with retained focus and actual timed advancement');

  await evaluate("document.querySelector('.opc-carousel-toggle').focus()");
  assert.ok((await state()).reason.includes('focus'));
  assert.equal(await evaluate("document.querySelector('.opc-carousel-toggle').textContent"), '播放');
  await evaluate("document.querySelector('.opc-carousel-toggle').click()");
  assert.equal((await state()).playing, true);
  assert.equal(await evaluate("document.activeElement.classList.contains('opc-carousel-toggle')"), true);
  const focusedPlayback = (await state()).index;
  await sleep(5850);
  assert.notEqual((await state()).index, focusedPlayback);
  await evaluate("document.querySelector('.opc-carousel-dot').focus()");
  assert.ok((await state()).reason.includes('focus'));
  await evaluate("document.querySelector('.opcheader a').focus()");
  check('explicit play advances with retained control focus and the next focus entry pauses again');

  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 400, y: 600 });
  await until("document.querySelector('.hero-carousel').dataset.opcPauseReason.includes('hover')", 'Pointer hover did not pause');
  await evaluate("document.querySelector('.opc-carousel-toggle').click()");
  assert.equal((await state()).playing, true);
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: -10, y: -10 });
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 400, y: 600 });
  await until("document.querySelector('.hero-carousel').dataset.opcPauseReason.includes('hover')", 'New hover entry did not clear explicit play override');
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: -10, y: -10 });
  check('real pointer entry pauses autoplay, explicit play overrides it until the next entry');

  const beforeTouch = (await state()).index;
  await S('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 800, y: 600 }] });
  assert.ok((await state()).reason.includes('touch'));
  await S('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 700, y: 600 }] });
  await S('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal((await state()).index, beforeTouch % 4 + 1);
  assert.ok(!(await state()).reason.includes('touch'));
  check('real touch gesture pauses during contact and advances on horizontal swipe');

  await media('reduce');
  await until("document.querySelector('.hero-carousel').dataset.opcPauseReason.includes('reduced-motion')", 'Changing system preference did not pause');
  const reduced = (await state()).index;
  await sleep(5850);
  assert.equal((await state()).index, reduced);
  assert.equal(await evaluate("document.querySelectorAll('[data-opc-reveal=\"pending\"]').length"), 0);
  assert.equal(await evaluate("[...document.querySelectorAll('.hero-carousel .el-carousel__item,[data-opc-reveal=\"shown\"]')].every(e=>getComputedStyle(e).transitionDuration.split(',').every(value=>parseFloat(value)===0))"), true);
  await evaluate("document.querySelectorAll('.opc-carousel-dot')[1].click()");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.el-carousel__item.is-active')).opacity"), '1');
  await media('no-preference');
  check('runtime reduced-motion stops playback, reveals content, and removes slide/reveal transitions');

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
    const navigation = await evaluate(`(() => {const nav=document.querySelector('.nav-links'),menu=document.querySelector('.mobile-menu');return{display:getComputedStyle(nav).display,direction:getComputedStyle(nav).flexDirection,menu:getComputedStyle(menu).display,iconColor:getComputedStyle(menu.querySelector('i')).color,overflow:document.documentElement.scrollWidth-innerWidth}})()`);
    assert.equal(navigation.overflow, 0, `Horizontal overflow at ${width}`);
    if (width < 1280) {
      assert.equal(navigation.display, 'none', `Menu was expanded at ${width}`); assert.notEqual(navigation.menu, 'none');
      assert.equal(navigation.iconColor, 'rgb(255, 255, 255)', `Homepage hamburger contrast at ${width}`);
      await evaluate("document.querySelector('.mobile-menu').click()");
      await until("document.querySelector('.mobile-menu').getAttribute('aria-expanded')==='true'", 'Menu did not open');
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.nav-links')).display"), 'flex');
      await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
      assert.equal(await evaluate("getComputedStyle(document.querySelector('.nav-links')).display"), 'none');
    } else { assert.equal(navigation.display, 'flex'); assert.equal(navigation.direction, 'row'); assert.equal(navigation.menu, 'none'); }
    check(`navigation breakpoint ${width}px`, navigation);
  }

  await S('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluate('window.scrollTo(0,300)');
  await until("document.querySelector('.opcheader nav').classList.contains('scrolled')", 'Header did not adopt its scrolled state');
  await until("getComputedStyle(document.querySelector('.mobile-menu i')).color==='rgb(26, 35, 51)'", 'Scrolled hamburger did not transition to ink');
  await evaluate("document.querySelector('.mobile-menu').click()");
  const linkPoint = await evaluate("(()=>{const r=document.querySelector('.nav-links a[href=\"/agent\"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', ...linkPoint });
  await sleep(350);
  const hoverColor = await evaluate("(()=>{const s=getComputedStyle(document.querySelector('.nav-links a[href=\"/agent\"]'));return {color:s.color,background:s.backgroundColor}})()");
  assert.equal(hoverColor.color, 'rgb(255, 255, 255)');
  assert.equal(hoverColor.background, 'rgba(255, 255, 255, 0.12)');
  await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x: -10, y: -10 });
  await S('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape' });
  check('1200px expanded navigation retains white text over a translucent dark-menu hover', hoverColor);
  await S('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluate('window.scrollTo(0,0)');
  await until("!document.querySelector('.opcheader nav').classList.contains('scrolled')", 'Header did not recover its hero state');
  await until("getComputedStyle(document.querySelector('.mobile-menu i')).color==='rgb(255, 255, 255)'", 'Homepage hamburger did not recover its white color');
  check('mobile hamburger remains visible against both dark and scrolled light headers');

  await evaluate("window.__detachedCarousel=document.querySelector('.hero-carousel');document.querySelector('.mobile-menu').click();document.querySelector('.nav-links a[href=\"/agent\"]').click()");
  await until("location.pathname==='/agent'&&document.querySelector('.tool-card')&&!document.querySelector('.opc-carousel-controls')", 'Client navigation did not finish');
  await until("getComputedStyle(document.querySelector('.mobile-menu i')).color==='rgb(26, 35, 51)'", 'Inner-page hamburger did not transition to ink');
  assert.equal(await evaluate('window.__detachedCarousel.isConnected'), false);
  const detachedIndex = await evaluate('window.__detachedCarousel.dataset.opcSlide');
  await sleep(5850);
  assert.equal(await evaluate('window.__detachedCarousel.dataset.opcSlide'), detachedIndex);
  assert.equal(await evaluate("document.querySelectorAll('.opc-carousel-controls').length"), 0);
  check('client route change removes carousel enhancement and stops its timer; inner-page hamburger uses ink');

  // Disable page scripts before navigation: the document must remain complete.
  await S('Emulation.setScriptExecutionDisabled', { value: true });
  await S('Page.navigate', { url: base + '/' });
  await sleep(1300);
  assert.equal(await evaluate("document.querySelectorAll('[data-opc-reveal=\"pending\"]').length"), 0);
  assert.ok(await evaluate("!!document.querySelector('h1')&&document.documentElement.scrollHeight>3000"));
  check('no-JavaScript SSR content stays visible');
  await mkdir('.screenshots', { recursive: true });
  await writeFile('.screenshots/opc-motion-audit.json', JSON.stringify({ base, startedAt, finishedAt: new Date().toISOString(), checks }, null, 2));
  console.log(`${checks.length} browser motion checks passed`);
} catch (error) {
  await mkdir('.screenshots', { recursive: true });
  await writeFile('.screenshots/opc-motion-audit.json', JSON.stringify({ base, startedAt, failedAt: new Date().toISOString(), checks, error: String(error) }, null, 2));
  throw error;
} finally {
  socket?.close();
  chrome.kill();
}
