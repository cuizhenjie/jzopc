import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { getReplicaArticle, getReplicaPage } from '@/lib/opc/content';
import { replicaPaths } from '@/lib/opc/routes';
import { intros, advantages, visions, empowerModules } from '@/lib/site/config';

test('every public route has a substantive local page and preserves original scoped layout', () => {
  assert.equal(replicaPaths.length, 18); // GPU资源页已下线
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
  // P1 动态内容契约（docs/14）：/newslist、/activitylist 的卡片改为运行时注入，
  // pages.json 只留占位符；构建期快照 list-cards.json 与改动前烘焙卡逐字节一致，
  // 完整性守卫改对拍快照串（/market 的卡片仍烘焙在 pages.json）。
  const snapshot = JSON.parse(readFileSync('src/lib/opc/generated/list-cards.json', 'utf8'));
  for (const [path, category, html] of [
    ['/newslist', '10', snapshot.news],
    ['/activitylist', '16', snapshot.activities],
    ['/market', '14', getReplicaPage('/market')!.html],
  ] as const) {
    const ids = new Set([...html.matchAll(/data-opc-id="(\d+)"/g)].map(match => Number(match[1])));
    for (const id of source.categories[category].ids) assert.ok(ids.has(id), `${path}: ${id}`);
    assert.equal(ids.size, source.categories[category].total);
  }
});

test('city variants retain their source descriptions and global contact address', () => {
  const page = getReplicaPage('/zone', { city: '上海' })!;
  assert.match(page.html, /上海作为国际化大都市/);
  // 联系地址是**全站统一**的那一个（不是按城市变的）。
  // ⚠️ 原站运营方（同橙）的地址已换成本站地址 —— 见 build-opc-content.py 的
  // replace_operator_contact()；本站地址与 src/lib/site/config.ts 的 site.address 一致
  // （2026-10-23 契约 docs/15：地址口径收敛为「北京丰台大红门」）。
  assert.match(page.html, /北京市丰台区大红门/);
  assert.doesNotMatch(page.html, /西马场/);
  assert.doesNotMatch(page.html, /上海市鼓楼区/);
  // 社区名里的运营方品牌已换成本站品牌（OPC 作为业务概念词保留）
  assert.match(page.html, /松江大学城科创源·集智 AI OPC 社区/);
  assert.equal(getReplicaPage('/zone', { city: '<script>' })?.title, getReplicaPage('/zone')?.title);
});

test('SSR metrics contain final values instead of captured animation frames', () => {
  const home = getReplicaPage('/')!.html;
  // 2026-10-23 契约 docs/15 §2.Req2：指标换为 500+/1000+/100+/50+。
  for (const value of ['500+', '1000+', '100+', '50+']) assert.ok(home.includes(value));
  for (const label of ['入驻智能体', '活跃创业者', '精品课程', '生态伙伴企业']) assert.ok(home.includes(label));
  assert.doesNotMatch(home, /496\+|992\+|198\+|1,000\+/);
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

test('all homepage feature entries have native links matching the public source', () => {
  const home = getReplicaPage('/')!.html;
  const entries = [...home.matchAll(/<a\b([^>]*class="ftr-node[^>]*)>([\s\S]*?)<\/a>/g)];
  // GPU资源特性卡已随 /computingresource 页面下线（2026-10），7 张卡自动回流
  assert.equal(entries.length, 7);
  const destinations = entries.map(match => match[1].match(/href="([^"]+)"/)?.[1]);
  assert.deepEqual(destinations, ['/agent', '/market', '/center', '/starproject', '/community', '/work', 'https://th.jimei.cn']);
  const external = entries.find(match => match[1].includes('https://th.jimei.cn'))!;
  assert.match(external[1], /target="_blank"/);
  assert.match(external[1], /rel="noopener noreferrer"/);
});

test('generated public bodies, article shell and city variants contain no second navigation', () => {
  for (const name of ['pages', 'zone-cities', 'article-shell']) {
    const raw = JSON.parse(readFileSync(`src/lib/opc/generated/${name}.json`, 'utf8'));
    const records = name === 'article-shell' ? [raw] : Object.values(raw) as { html: string }[];
    for (const record of records) {
      assert.doesNotMatch(record.html, /class="[^"]*\b(?:opcheader|menu-backdrop|nav-links|mobile-menu)\b/);
      assert.doesNotMatch(record.html, /data-opc-action="menu"/);
    }
  }
  const compiler = readFileSync('scripts/build-opc-content.py', 'utf8');
  assert.doesNotMatch(compiler, /def rebuild_nav|NAV_ABOUT_ITEMS|NAV_EMPOWER_ITEMS|NAV_COMMUNITY_ITEMS/);
});

test('about follows the reference composition while every company claim stays in approved Jizhi copy', () => {
  const page = getReplicaPage('/about')!;
  const html = page.html;
  const shared = JSON.parse(readFileSync('src/lib/site/about-copy.json', 'utf8'));
  assert.deepEqual(shared.intros, intros);
  assert.deepEqual(shared.advantages, advantages);
  assert.deepEqual(shared.visions, visions);
  assert.equal(page.title, '关于集智 - 集智 AI OPC 社区');
  assert.match(html, /data-opc-about-page/);
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  assert.equal([...html.matchAll(/class="hero-section opc-visual-hero has-visual"/g)].length, 1);
  assert.equal([...html.matchAll(/class="opcbottom"/g)].length, 1);
  for (const copy of [...intros.v3, ...advantages, ...visions]) assert.ok(html.includes(copy), copy);
  for (const forbidden of ['江苏', '南京', '研究院', '成果转化项目', '基金直投企业', '订单市场']) {
    assert.ok(!html.includes(forbidden), forbidden);
  }
  const sections = ['opc-about-overview', 'opc-about-drivers', 'opc-about-enablers', 'opc-about-journey', 'opc-about-vision', 'opcbottom'];
  const positions = sections.map(name => html.indexOf(name));
  assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])));
  assert.equal([...html.matchAll(/class="opc-about-driver"/g)].length, 3);
  const enablers = html.match(/<ul\b[^>]*class="opc-about-enabler-list"[^>]*>([\s\S]*?)<\/ul>/)?.[1];
  assert.ok(enablers);
  assert.equal([...enablers.matchAll(/<a\b/g)].length, 8);
  for (const module of empowerModules) {
    assert.ok(enablers.includes(`href="${module.href}"`), module.href);
    assert.ok(enablers.includes(module.title), module.title);
  }
  assert.deepEqual([...html.matchAll(/<time\b[^>]*datetime="([^"]+)"/g)].map(match => match[1]), ['2026-10']);
  assert.match(html, /更多发展节点持续整理中/);
  assert.match(html, /窗外城市景观/);
  assert.doesNotMatch(html, /集智(?:园区|空间)实景/);
  for (const paragraph of intros.v2.split('\n')) assert.ok(getReplicaPage('/')!.html.includes(paragraph));
  assert.doesNotMatch(getReplicaPage('/')!.html, /订单市场/);
});

test('agent layout preserves every tool and filter action in SSR, academy courses lead directly into employment', () => {
  const agent = getReplicaPage('/agent')!.html;
  for (const marker of ['data-opc-agent-layout', 'data-opc-agent-sidebar', 'data-opc-agent-results', 'data-opc-agent-status']) {
    assert.equal([...agent.matchAll(new RegExp(`\\s${marker}(?:=|\\s|>)`, 'g'))].length, 1, marker);
  }
  assert.equal([...agent.matchAll(/class="tool-card[^"]*"/g)].length, 233);
  assert.equal([...agent.matchAll(/data-opc-agent-group="/g)].length, 18);
  assert.equal([...agent.matchAll(/data-opc-action="filter-tools"/g)].length, 19);
  assert.match(agent, /data-opc-agent-status=""[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(agent, /共 233 个智能体/);
  assert.match(agent, /data-opc-search="tools"/);
  assert.doesNotMatch(agent, /data-opc-action="filter-category"/);
  const center = getReplicaPage('/center')!.html;
  assert.match(center, /data-opc-academy-layout/);
  assert.equal([...center.matchAll(/class="opc-academy-course-card"/g)].length, 5);
  assert.equal([...center.matchAll(/class="opc-employ-num"/g)].length, 6);
  const courses = center.indexOf('class="opc-academy-course-grid"');
  const employment = center.indexOf('class="opc-employ-steps"');
  const gallery = center.indexOf('data-opc-gallery="academy"');
  assert.ok(courses > 0 && employment > courses && gallery > employment);
  for (const name of ['AI电商', 'AIGC', 'AI漫剧', '大数据工程师', '短视频运营', '职业测评', '技能培训', '项目实战', '求职面试', '就业推荐', '入职跟踪']) {
    assert.ok(center.includes(name), name);
  }
});

test('contract copy lands on the rewritten sections', () => {
  // 首页 banner（Req2）
  const home = getReplicaPage('/')!.html;
  assert.ok(home.includes('一站式 AI 应用综合赋能平台，为创业者提供空间、算力、技术、培训、流量、订单、企业服务、资本政策全方位的支持。'));
  // 关于文案（Req3）
  assert.ok(home.includes('北京集美科技有限公司 · 2026 年 10 月启动运营'));
  assert.ok(home.includes('位于北京丰台大红门'));
  // 合作企业 16 家（Req6，首页与 /work 共用 visual_ecosystem）
  for (const source of ['/', '/work']) {
    const html = getReplicaPage(source)!.html;
    assert.ok(html.includes('COOPERATIVE ENTERPRISES') && html.includes('合作企业'), source);
    const grid = html.slice(html.indexOf('opc-visual-partner-grid'));
    for (const partner of ['华为', '字节跳动', '哔哩哔哩', '豆瓣', '携程']) {
      assert.ok(grid.includes(partner), `${source}: ${partner}`);
    }
    assert.equal((grid.match(/opc-visual-partner-card/g) ?? []).length, 16, source);
    assert.ok(!html.includes('AI ECOSYSTEM') && !html.includes('opc-visual-logo-card'), source);
  }
  // /agent（Req4）
  assert.ok(getReplicaPage('/agent')!.html.includes('集智·探索 AI 的无限可能'));
  // /market 加入区（Req5+Req7）
  const market = getReplicaPage('/market')!.html;
  assert.ok(market.includes('加入集智 AI 供需市场'));
  assert.ok(market.includes('上架智能体能力，发布项目需求，链接产业伙伴，共筑 AI 产业新生态'));
  for (const step of ['供需发布', '智能匹配', '能力展示', '产业共创']) assert.ok(market.includes(step), step);
  // 集智商学院四段（Req8）
  const center = getReplicaPage('/center')!.html;
  assert.ok(center.includes('hero-slogan') && center.includes('学AI技能拿高薪Offer让未来，从这里开始'));
  assert.ok(center.includes('提供AI人才培养与就业服务，助力个人成长与企业数字化升级'));
  for (const feature of ['实战教学', 'AIGC认证', '研学班', '项目驱动', '名企合作']) {
    assert.ok(center.includes(feature), feature);
  }
  assert.ok(!center.includes('视频教学'));
  assert.ok(center.includes('培训课程体系') && center.includes('紧跟行业需求，打造系统化AI人才培养体系'));
  assert.ok(center.includes('AI电商') && center.includes('Hadoop、Spark、Flink 技术栈'));
  assert.ok(!center.includes('category-tab') && !center.includes('course-detail'), 'old course tabs/cards removed');
  assert.ok(center.includes('一站式就业服务') && center.includes('从学习到就业，全程陪伴，让每一次努力都有结果'));
  for (const step of ['职业测评', '技能培训', '项目实战', '求职面试', '就业推荐', '入职跟踪']) {
    assert.ok(center.includes(step), step);
  }
  assert.ok(center.includes('STEP 06'));
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
  const visualManifest = JSON.parse(readFileSync('scripts/opc-source/visual-media.json', 'utf8'));
  const visualPaths = new Set(visualManifest.assets.flatMap((asset: { variants: { url: string }[] }) => asset.variants.map(variant => variant.url)));
  for (const name of ['pages', 'details', 'zone-cities']) {
    const records = JSON.parse(readFileSync(`src/lib/opc/generated/${name}.json`, 'utf8')) as Record<string, { html: string }>;
    for (const record of Object.values(records)) {
      for (const match of record.html.matchAll(/\ssrc="([^"]+)"/g)) {
        assert.ok(visualPaths.has(match[1]) || localRoots.some((root) => match[1].startsWith(root)), match[1]);
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
    assert.match(page.html, /北京市丰台区大红门/, path);
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
