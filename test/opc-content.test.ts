import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { getReplicaArticle, getReplicaPage } from '@/lib/opc/content';
import { replicaPaths } from '@/lib/opc/routes';

test('every public route has a substantive local page and preserves original scoped layout', () => {
  assert.equal(replicaPaths.length, 20);
  for (const path of replicaPaths) {
    const page = getReplicaPage(path);
    assert.ok(page, path);
    assert.ok(page.html.length > 1500, path);
    assert.ok(page.title.length > 2, path);
    assert.match(page.html, /data-v-[a-z0-9]+/, path);
    assert.doesNotMatch(page.html, /(?:href="#\/|<script\b|<iframe\b|\son\w+=|javascript:)/i, path);
  }
});

test('article lookup resolves all published records and rejects traversal or missing IDs', () => {
  const source = JSON.parse(readFileSync('src/lib/opc/generated/listings.json', 'utf8'));
  assert.equal(Object.keys(source.records).length, 158);
  for (const record of Object.values(source.records) as { id: number; title: string }[]) {
    const article = getReplicaArticle(record.id);
    assert.equal(article?.title, record.title);
    assert.ok(article?.html.length, String(record.id));
    assert.doesNotMatch(article!.html, /<(?:script|iframe|object|embed)\b|\son\w+=|javascript:|expression\(/i);
  }
  for (const id of ['../392', '392/../1', '__proto__', '0', '-1', '1e2', '9999999999']) {
    assert.equal(getReplicaArticle(id), null, id);
  }
  assert.equal(getReplicaPage('/newsdetail', { id: '../392' }), null);
  assert.match(getReplicaPage('/newsdetail', { id: '392' })!.html, /data-opc-article/);
  assert.equal(getReplicaPage('/unknown'), null);
});

test('all list pages contain every public record beyond the first captured page', () => {
  const source = JSON.parse(readFileSync('src/lib/opc/generated/listings.json', 'utf8'));
  for (const [path, category] of [['/newslist', '10'], ['/activitylist', '16'], ['/market', '14']] as const) {
    const page = getReplicaPage(path)!;
    const ids = new Set([...page.html.matchAll(/data-opc-id="(\d+)"/g)].map(match => Number(match[1])));
    for (const id of source.categories[category].ids) assert.ok(ids.has(id), `${path}: ${id}`);
    assert.equal(ids.size, source.categories[category].total);
  }
});

test('city variants retain their source descriptions and global contact address', () => {
  const page = getReplicaPage('/zone', { city: '上海' })!;
  assert.match(page.html, /上海作为国际化大都市/);
  assert.match(page.html, /南京市鼓楼区古平岗4号/);
  assert.doesNotMatch(page.html, /上海市鼓楼区/);
  assert.match(page.html, /松江大学城科创源·同橙OPC社区/);
  assert.equal(getReplicaPage('/zone', { city: '<script>' })?.title, getReplicaPage('/zone')?.title);
});

test('SSR metrics contain final values instead of captured animation frames', () => {
  const home = getReplicaPage('/')!.html;
  for (const value of ['500+', '1,000+', '200+', '50+']) assert.ok(home.includes(value));
  assert.doesNotMatch(home, /496\+|992\+|198\+/);
  const work = getReplicaPage('/work')!.html;
  assert.match(work, /class="count-num"[^>]*>500<\/span>/);
  assert.match(work, /class="count-num"[^>]*>10,000<\/span>/);
  assert.match(work, /class="count-num"[^>]*>5,000,000<\/span>/);
});

test('captured forms never submit passwords or personal fields through native GET navigation', () => {
  for (const path of ['/opclogin', '/opcregister', '/opcforgotpassword', '/starjoin', '/opcapply']) {
    const page = getReplicaPage(path)!;
    assert.doesNotMatch(page.html, /<form\b|type="submit"|\saction=|\smethod=/i);
    assert.match(page.html, /role="form"/);
  }
});

test('account navigation remains keyboard and no-JavaScript accessible', () => {
  const cases = {
    '/opclogin': { '忘记密码？': '/opcforgotpassword', '立即注册': '/opcregister', '返回首页': '/' },
    '/opcregister': { '立即登录': '/opclogin', '返回首页': '/' },
    '/opcforgotpassword': { '返回登录': '/opclogin', '返回首页': '/' },
  };
  for (const [path, expected] of Object.entries(cases)) {
    const anchors = [...getReplicaPage(path)!.html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
    for (const [label, destination] of Object.entries(expected)) {
      const anchor = anchors.find(match => match[2].replace(/<[^>]+>/g, '').trim() === label);
      assert.ok(anchor, `${path}: ${label}`);
      assert.ok(anchor[1].includes(`href="${destination}"`), `${path}: ${label}`);
    }
  }
});

test('appended supply cards use their own dates, authors and avatar initials', () => {
  const page = getReplicaPage('/market')!.html;
  for (const [id, author, initial] of [['33', 'OPC服务团队', 'O'], ['34', 'AI漫剧社', 'A']]) {
    const card = page.match(new RegExp(`<article\\b[^>]*data-opc-id="${id}"[^>]*>([\\s\\S]*?)<\\/article>`))?.[1];
    assert.ok(card, id);
    assert.match(card, /class="sc-date">2026\/4\/8<\/span>/);
    assert.ok(card.includes(`class="sc-author-name">${author}</span>`));
    assert.ok(card.includes(`class="sc-avatar">${initial}</div>`));
    assert.doesNotMatch(card, /2026\/6\/25|class="sc-avatar">詹/);
  }
});

test('all eight homepage feature entries have native links matching the public source', () => {
  const home = getReplicaPage('/')!.html;
  const entries = [...home.matchAll(/<a\b([^>]*class="ftr-node[^>]*)>([\s\S]*?)<\/a>/g)];
  assert.equal(entries.length, 8);
  const destinations = entries.map(match => match[1].match(/href="([^"]+)"/)?.[1]);
  assert.deepEqual(destinations, ['/agent', '/market', '/center', '/starproject', '/community', '/work', 'https://ai.opcstore.com', '/computingresource']);
  const external = entries.find(match => match[1].includes('https://ai.opcstore.com'))!;
  assert.match(external[1], /target="_blank"/);
  assert.match(external[1], /rel="noopener noreferrer"/);
});

test('GPU rental actions retain each source offer context', () => {
  const page = getReplicaPage('/computingresource')!.html;
  const routes = [...page.matchAll(/data-opc-route="(\/opcapply\?[^\"]+)"/g)].map(match => new URL(match[1].replaceAll('&amp;', '&'), 'http://localhost'));
  assert.equal(routes.length, 8);
  assert.equal(new Set(routes.map(url => url.searchParams.get('serverName'))).size, 8);
  for (const url of routes) {
    assert.equal(url.searchParams.get('formType'), 'computing');
    assert.ok(url.searchParams.get('serverCompute'));
    assert.match(url.searchParams.get('serverPrice') ?? '', /包月租赁.+包年租赁/);
  }
});

test('HTML compiler rejects adversarial elements, attributes, CSS and URLs', () => {
  const output = execFileSync('python3', ['scripts/build-opc-content.py', '--test'], { encoding: 'utf8' });
  assert.match(output, /sanitizer checks passed/);
});

test('every generated page and article image resolves to a present local asset', () => {
  let images = 0;
  for (const name of ['pages', 'details', 'zone-cities']) {
    const records = JSON.parse(readFileSync(`src/lib/opc/generated/${name}.json`, 'utf8')) as Record<string, { html: string }>;
    for (const record of Object.values(records)) {
      for (const match of record.html.matchAll(/\ssrc="([^"]+)"/g)) {
        assert.ok(match[1].startsWith('/opc/assets/'), match[1]);
        assert.ok(existsSync(`public${match[1]}`), match[1]);
        images += 1;
      }
    }
  }
  assert.ok(images > 700);
});
