import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
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
  // 联系地址是**全站统一**的那一个（不是按城市变的）。
  // ⚠️ 原站运营方（同橙）的地址已换成本站地址 —— 见 build-opc-content.py 的
  // replace_operator_contact()；本站地址与 src/lib/site/config.ts 的 site.address 一致。
  assert.match(page.html, /北京市丰台区西马场甲14号/);
  assert.doesNotMatch(page.html, /上海市鼓楼区/);
  // 社区名里的运营方品牌已换成本站品牌（OPC 作为业务概念词保留）
  assert.match(page.html, /松江大学城科创源·集智 AI OPC 社区/);
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
  assert.deepEqual(destinations, ['/agent', '/market', '/center', '/starproject', '/community', '/work', 'https://th.jimei.cn', '/computingresource']);
  const external = entries.find(match => match[1].includes('https://th.jimei.cn'))!;
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
  // 本站自有媒体（品牌标记与科技蓝主视觉）来自 public/ 根目录，
  // 其余素材来自原站镜像，统一落在 public/opc/assets/。
  const localRoots = ['/opc/assets/', '/logo-mark', '/opc/hero-'];
  for (const name of ['pages', 'details', 'zone-cities']) {
    const records = JSON.parse(readFileSync(`src/lib/opc/generated/${name}.json`, 'utf8')) as Record<string, { html: string }>;
    for (const record of Object.values(records)) {
      for (const match of record.html.matchAll(/\ssrc="([^"]+)"/g)) {
        assert.ok(localRoots.some((root) => match[1].startsWith(root)), match[1]);
        assert.ok(existsSync(`public${match[1]}`), match[1]);
        images += 1;
      }
    }
  }
  assert.ok(images > 700);
});

test('the reference operator brand is fully replaced by this site brand', () => {
  // 「同橙」是参考站运营方品牌，「OPC Store」是参考站站点名，
  // 两者都不允许出现在本站的任何生成内容里。
  // 注意：OPC 本身是业务概念词（One Person Company），不应被替换。
  for (const name of ['pages', 'details', 'zone-cities', 'directory', 'listings', 'article-shell']) {
    const raw = readFileSync(`src/lib/opc/generated/${name}.json`, 'utf8');
    assert.ok(!raw.includes('同橙'), `${name} still contains 同橙`);
    assert.ok(!raw.includes('OPC Store'), `${name} still contains OPC Store`);
    assert.ok(!raw.includes('OPCStore'), `${name} still contains OPCStore`);
    // 原站域名与运营方身份信息（电话/邮箱/地址/备案号）都不是本站的
    for (const residue of ['tongcc', 'tongcheng', '025-86551126', 'hr@tongcheng.ai',
      '南京市鼓楼区古平岗4号', '苏ICP备2026012874号']) {
      assert.ok(!raw.includes(residue), `${name} still contains ${residue}`);
    }
  }
});

test('site contact surfaces carry this site identity and never the reference operator identity', () => {
  // 本站自己的联系位（页脚「联系我们」、关于页联系卡）必须换成本站信息，
  // 且不得出现原运营方（同橙）的电话 / 邮箱 / 域名 / 备案号 / 总部地址。
  // 2026-10-22 业务方已提供电话与邮箱 → 这两项**应当**出现在联系位里；
  // **备案号未提供** → 一律不渲染（原运营方的备案号已删除，不顶替）。
  for (const path of ['/', '/about', '/zone']) {
    const page = getReplicaPage(path)!;
    assert.match(page.html, /北京市丰台区西马场甲14号/, path);
    assert.match(page.html, /400-006-5858/, path);
    assert.match(page.html, /developer@jimei\.com\.cn/, path);
    assert.match(page.html, /www\.jizhiai\.net\.cn/, path);
    for (const residue of ['025-86551126', 'tongcheng', 'tongcc', 't.3cool.cc',
      'ai.opcstore.com', '苏ICP备2026012874号', '南京市鼓楼区古平岗4号', 'ICP备案']) {
      assert.ok(!page.html.includes(residue), `${path} still contains ${residue}`);
    }
  }
});

test('runtime source files contain no reference-site brand residue', () => {
  // ⚠️ 生成期替换只覆盖 scripts/build-opc-content.py 产出的 JSON；
  // **运行期拼出来的文案不经过那套替换** ——
  // 实测新闻详情页 <title> 漏出过「同橙OPC社区平台」，
  // /llms.txt 的抬头也是「OPC Store · 同橙OPC社区」。
  // 上一条用例只看生成产物，天然看不见这类泄漏，这里把 src/ 全量纳入守卫。
  const exts = new Set(['.ts', '.tsx', '.json', '.txt']);
  const skipDirs = new Set(['src/lib/opc/generated']); // 已由上一条用例覆盖
  const hits: string[] = [];

  /**
   * 去掉注释再扫。
   *
   * 注释里经常要写「原站叫『同橙』」这类说明（那正是本文件要记录的历史），
   * 但注释不会出现在产物里，不该算残留。
   * 只扫注释之外的内容 —— 字符串字面量仍会被命中，这正是我们要抓的。
   */
  const stripComments = (raw: string) => raw
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!skipDirs.has(p)) walk(p);
        continue;
      }
      if (!exts.has(extname(entry.name))) continue;
      const raw = stripComments(readFileSync(p, 'utf8'));
      for (const word of ['同橙', 'OPC Store', 'OPCStore', 'tongcc', 'tongcheng']) {
        if (raw.includes(word)) hits.push(`${p} → ${word}`);
      }
    }
  };
  walk('src');

  assert.deepEqual(hits, [], `brand residue in runtime source:\n${hits.join('\n')}`);
});

test('replica page titles and llms.txt carry this site brand', () => {
  // 运行期拼出来的标题与 llms.txt 也必须是本站品牌。
  const article = getReplicaArticle('392');
  assert.ok(article, 'article 392 should resolve');
  const detail = getReplicaPage('/newsdetail', { id: '392' });
  assert.ok(detail, 'newsdetail should resolve');
  assert.match(detail.title, /集智 ?AI/);
  assert.doesNotMatch(detail.title, /同橙/);
  // 站名口径以《集智AI 网站.docx》为准：集智 AI OPC 社区（无「平台」后缀）
  assert.ok(detail.title.endsWith('集智 AI OPC 社区'), detail.title);
});
