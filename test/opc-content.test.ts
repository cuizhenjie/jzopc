/**
 * 公开站烘焙产物（src/lib/opc/generated/pages.json）的契约测试。
 *
 * ── 为什么整份重写（2026-11-10 全站复刻替换）────────────────────────────
 *
 * 旧版断言的是 **opcstore.com 旧快照**的契约：
 *   - 18 条路由、每页 `data-v-*` 作用域属性、233 张工具卡、158 条公开新闻、
 *     22 条供需卡、/zone 城市变体、details.json / listings.json / list-cards.json
 *     三套烘焙产物、build-opc-content.py 的净化器自测……
 *
 * 这些**全部随旧站下线**（旧产物 details.json / zone-cities.json / directory.json /
 * listings.json / list-cards.json 已不再被任何运行期代码消费），
 * 因此对应断言在新架构下**已无意义**，逐条删除并在下面标注原因。
 *
 * 新契约（参考站 https://jizhi-ai-opc.app.workbuddy.host/ 的快照复刻）：
 *   1. 事实源是 scripts/opc-reference/ → scripts/build-opc-reference.mjs
 *      → generated/pages.json（10 个路由）；
 *   2. 页面正文**不含外壳**（导航/页脚由 React 渲染）；
 *   3. 页面正文**不含脚本 / 事件属性 / 编辑器残留**；
 *   4. 图片只指向站内参考站素材目录，且文件真实存在；
 *   5. 站内链接只指向已声明的公开路由或该页真实存在的锚点；
 *   6. 全站无旧站品牌与旧口径残留。
 *
 * 删除的旧断言（逐条说明）：
 *   - 「18 条路由 + data-v-* 作用域属性 + 233 张工具卡 + /center 课程卡」
 *     → 旧站结构，随旧站下线；
 *   - 「getReplicaArticle / listings.json 158 条记录」→ API 已删除（见
 *     src/lib/opc/content.ts：只剩 getReplicaPage），详情改由 DB 驱动；
 *   - 「list-cards.json 快照对拍 / listings.json 分类完整性」
 *     → 双列表通道（/newslist + /activitylist）已下线，改为单一 /news；
 *   - 「/zone 城市变体」→ 参考站无该页；
 *   - 「首页 500+/1000+/100+/50+ 指标、ftr-node 特性卡、合作企业 16 家」
 *     → 旧站文案与结构；
 *   - 「build-opc-content.py 净化器自测」→ 净化器已换成
 *     scripts/build-opc-reference.mjs（sanitize-html 白名单）；
 *   - 「opcheader / nav-links / mobile-menu 类名」→ 换成参考站外壳类名
 *     （.nav / .menu / .ft），见下方「页面正文不含第二套导航」。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { escapeText, getReplicaPage, listReplicaPaths, REPLICA_SITE_NAME } from '@/lib/opc/content';
import { replicaPaths } from '@/lib/opc/routes';

const pagesSource = JSON.parse(readFileSync('src/lib/opc/generated/pages.json', 'utf8')) as Record<
  string,
  { title: string; html: string }
>;
const manifest = JSON.parse(readFileSync('src/lib/opc/generated/manifest.json', 'utf8')) as {
  source: string;
  routeCount: number;
  images: number;
  checksums: Record<string, string>;
};

/** 路由 → 参考站页面原件（与 scripts/build-opc-reference.mjs 的 ROUTES 同表）。 */
const REFERENCE_SOURCE: Record<string, string> = {
  '/': 'index.html',
  '/about': 'about.html',
  '/health': 'health.html',
  '/empower': 'empower.html',
  '/market': 'market.html',
  '/growth': 'growth.html',
  '/academy': 'academy.html',
  '/news': 'news.html',
  '/apply': 'join.html',
  '/agent': 'agent.html',
};

/** 已声明的公开路由（烘焙快照里的 10 条 + DB 驱动的 /newsdetail + React 静态页 /agreement）。 */
const PUBLIC_ROUTES: Set<string> = new Set([...replicaPaths, '/agreement']);

/**
 * 行为锚点：hash 不对应任何 DOM id，由 ReferenceInteractions 读 hash 驱动交互。
 * 供需页两个首屏 CTA 拆成 #publish-need / #publish-give（2026-11-11 修复
 * 「我要发布需求」落到供给 Tab 的入口错位；区块滚动锚点仍是 #publish）。
 */
const BEHAVIORAL_FRAGMENTS: Record<string, Set<string>> = {
  '/market': new Set(['publish-need', 'publish-give']),
};

/** React 静态页的锚点不进烘焙 DOM，锚点清单与页面组件同步维护。 */
const REACT_PAGE_ANCHORS: Record<string, Set<string>> = {
  '/agreement': new Set(['covenant', 'notice']),
};

/** 参考站外壳类名 —— 出现在正文里就说明「第二个导航」漏进来了。 */
const SHELL_CLASSES = ['nav', 'menu', 'mlink', 'drop', 'burger', 'mnav', 'ft', 'ft__links', 'ft__ct', 'brand'];

test('烘焙产物覆盖参考站的 10 个路由，每页都有非空 html 与 title', () => {
  assert.equal(Object.keys(pagesSource).length, 10, '参考站快照应是 10 个路由');
  for (const path of Object.keys(pagesSource)) {
    const page = pagesSource[path];
    assert.ok(page, path);
    assert.ok(page.html.trim().length > 1000, `${path} 的 html 过短`);
    assert.ok(page.title.trim().length > 2, `${path} 缺 title`);
    assert.ok(page.title.includes(REPLICA_SITE_NAME), `${path} 的 title 口径不符：${page.title}`);
  }
  // 10 条路由与参考站页面原件一一对应
  assert.deepEqual(Object.keys(pagesSource).sort(), Object.keys(REFERENCE_SOURCE).sort());
});

test('/newsdetail 是唯一不入快照的公开路由（详情由 DB 驱动）', () => {
  assert.ok(PUBLIC_ROUTES.has('/newsdetail'));
  assert.ok(!Object.hasOwn(pagesSource, '/newsdetail'), '/newsdetail 不应烘焙静态页');
  assert.equal(getReplicaPage('/newsdetail'), null);
  // 快照里的 10 条都在公开路由表里
  for (const path of Object.keys(pagesSource)) assert.ok(PUBLIC_ROUTES.has(path), path);
});

test('getReplicaPage 只认已烘焙路由，未知路由返回 null 且大小写/尾斜杠归一', () => {
  for (const path of Object.keys(pagesSource)) {
    assert.ok(getReplicaPage(path), path);
    assert.ok(getReplicaPage(path.toUpperCase()), path);
    assert.ok(getReplicaPage(`${path}/`), path);
    assert.equal(getReplicaPage(path)?.path, path);
  }
  for (const path of ['/unknown', '/newslist', '/center', '/traffic', '/zone', '/opclogin', '/opcapply']) {
    assert.equal(getReplicaPage(path), null, path);
  }
});

test('listReplicaPaths 与 pages.json 的键完全一致', () => {
  assert.deepEqual(listReplicaPaths(), Object.keys(pagesSource).sort());
});

test('每页的图片都指向站内参考站素材目录，且文件真实存在', () => {
  let images = 0;
  for (const [path, page] of Object.entries(pagesSource)) {
    for (const match of page.html.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/g)) {
      const src = match[1];
      assert.ok(src.startsWith('/opc/reference/img/'), `${path} 的图片不在站内素材目录：${src}`);
      assert.ok(!src.startsWith('//'), `${path} 的图片不得是协议相对路径：${src}`);
      assert.ok(existsSync(`public${src}`), `${path} 的图片缺失：${src}`);
      images += 1;
    }
  }
  assert.ok(images >= 20, `参考站图片引用过少：${images}`);
});

test('页面 HTML 不含脚本、编辑器节点属性与内联事件属性', () => {
  for (const [path, page] of Object.entries(pagesSource)) {
    assert.doesNotMatch(page.html, /<script\b/i, `${path} 含脚本`);
    assert.doesNotMatch(page.html, /<iframe\b|<object\b|<embed\b/i, `${path} 含嵌入元素`);
    assert.doesNotMatch(page.html, /data-page-node-id/i, `${path} 含编辑器节点属性`);
    assert.doesNotMatch(page.html, /\son[a-z]+\s*=/i, `${path} 含内联事件属性`);
    assert.doesNotMatch(page.html, /javascript:/i, `${path} 含 javascript: 协议`);
  }
});

test('站内链接只指向已声明的公开路由或该页真实存在的锚点', () => {
  const idsOf = (path: string): Set<string> => {
    const page = pagesSource[path];
    if (!page) return new Set();
    return new Set([...page.html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  };
  for (const [path, page] of Object.entries(pagesSource)) {
    for (const match of page.html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
      const href = match[1];
      if (/^https?:\/\//i.test(href)) continue; // 外链单独校验
      const [target, fragment] = href.split('#');
      const targetPath = target || path;
      assert.ok(PUBLIC_ROUTES.has(targetPath), `${path} 的站内链接指向未声明路由：${href}`);
      if (fragment) {
        const known =
          REACT_PAGE_ANCHORS[targetPath] ?? idsOf(targetPath);
        assert.ok(
          BEHAVIORAL_FRAGMENTS[targetPath]?.has(fragment) || known.has(fragment),
          `${path} 的站内链接指向不存在的锚点：${href}`,
        );
      }
    }
  }
});

test('外链一律带 rel=noopener noreferrer，且不带 javascript: 协议', () => {
  for (const [path, page] of Object.entries(pagesSource)) {
    for (const match of page.html.matchAll(/<a\b([^>]*)>/g)) {
      const attributes = match[1];
      const href = /href="([^"]*)"/.exec(attributes)?.[1] ?? '';
      if (!/^https?:\/\//i.test(href)) continue;
      assert.match(attributes, /rel="noopener noreferrer"/, `${path} 的外链缺少 rel：${href}`);
    }
  }
});

test('页面正文不含第二套导航外壳（外壳由 React 渲染）', () => {
  for (const [path, page] of Object.entries(pagesSource)) {
    const classes = new Set<string>();
    for (const match of page.html.matchAll(/class="([^"]*)"/g)) {
      for (const name of match[1].split(/\s+/)) if (name) classes.add(name);
    }
    const shell = SHELL_CLASSES.filter((name) => classes.has(name));
    assert.deepEqual(shell, [], `${path} 的正文里出现了外壳结构（第二个导航）：${shell.join(', ')}`);
    // 旧站的页头 / 页脚容器名也不允许残留
    assert.doesNotMatch(page.html, /class="[^"]*\b(?:opcheader|opcbottom|nav-links|mobile-menu)\b/, path);
  }
});

test('全站无旧站品牌与旧口径残留', () => {
  const forbidden = [
    'opcstore.com', 'OPC Store', 'OPCStore', '同橙', 'tongcheng', 'tongcc',
    // 旧口径词（参考站复刻后已下线）
    '西马场', '豆包', '星计划企业', '1,000+', 'AI ECOSYSTEM',
  ];
  for (const [path, page] of Object.entries(pagesSource)) {
    for (const word of forbidden) {
      assert.ok(!page.html.includes(word), `${path} 仍含旧站残留：${word}`);
    }
  }
  // 产物文件本身（不只是 html 字段）同样干净
  const raw = readFileSync('src/lib/opc/generated/pages.json', 'utf8');
  for (const word of forbidden) assert.ok(!raw.includes(word), `pages.json 仍含旧站残留：${word}`);
});

test('烘焙产物的 title 与参考站 <title> 逐字一致', () => {
  for (const [path, source] of Object.entries(REFERENCE_SOURCE)) {
    const raw = readFileSync(`scripts/opc-reference/pages/${source}`, 'utf8');
    const reference = /<title>([^<]*)<\/title>/.exec(raw)?.[1];
    assert.ok(reference, `${source} 没有 <title>`);
    // 标题由编译期从参考站 <title> 直接提取（scripts/build-opc-reference.mjs），
    // 因此这里要求**逐字相等**——参考站改标题时产物自动跟随，不允许本地二次归一。
    assert.equal(pagesSource[path].title, reference, `${path} 的标题与参考站不一致`);
  }
});

test('manifest 记录来源、路由数、素材数与逐页校验和', () => {
  assert.match(manifest.source, /^https:\/\/jizhi-ai-opc\.app\.workbuddy\.host\//);
  assert.equal(manifest.routeCount, Object.keys(pagesSource).length);
  assert.equal(manifest.images, 27);
  for (const [path, page] of Object.entries(pagesSource)) {
    const digest = createHash('sha256').update(page.html).digest('hex').slice(0, 16);
    assert.equal(manifest.checksums[path], digest, `${path} 的校验和与产物不一致`);
  }
});

test('文章外壳保留三个占位符，且不含未替换的脚本', () => {
  const shell = JSON.parse(readFileSync('src/lib/opc/generated/article-shell.json', 'utf8')) as { html: string };
  for (const token of ['__OPC_TITLE__', '__OPC_DATE__', '__OPC_ARTICLE__']) {
    assert.ok(shell.html.includes(token), `文章外壳缺少占位符 ${token}`);
  }
  assert.doesNotMatch(shell.html, /<script\b|data-page-node-id|\son[a-z]+\s*=/i);
});

test('escapeText 转义全部五个危险字符，站内文案渲染安全', () => {
  assert.equal(escapeText('<script>'), '&lt;script&gt;');
  assert.equal(escapeText('a&b'), 'a&amp;b');
  assert.equal(escapeText('"q"'), '&quot;q&quot;');
  assert.equal(escapeText("'s'"), '&#39;s&#39;');
  assert.equal(escapeText('a<b>&"\'"'), 'a&lt;b&gt;&amp;&quot;&#39;&quot;');
});

test('站点名口径唯一：REPLICA_SITE_NAME 贯穿标题与详情标题', () => {
  assert.equal(REPLICA_SITE_NAME, '集智 AI OPC 社区');
  for (const page of Object.values(pagesSource)) {
    assert.ok(page.title.includes(REPLICA_SITE_NAME), page.title);
  }
});

test('参考站关键区块的内容在烘焙产物里完整保留', () => {
  const home = pagesSource['/'].html;
  assert.match(home, /集智 · 大健康\+<em>AI<\/em> OPC 社区/);
  assert.match(home, /集智OPC社区 {2}\| 健康管理 · AI赋能 · <span class="nowrap">社区连接<\/span>/);
  const heroEnd = home.indexOf('</section>');
  const hero = home.slice(0, heroEnd);
  // hero__meta 一行文案已删：首屏只留 slogan、定位语与统计数字墙（site_stats 动态注入）
  assert.doesNotMatch(hero, /hero__meta|首期空间　·|工位免租期　·/);
  assert.doesNotMatch(hero, /首期 3000\+ ㎡ 共享空间|“八大赋能”助力|大健康垂类AI OPC社区/);
  assert.match(home, /八大赋能/);
  assert.match(home, /订单市场/);
  assert.match(home, /大健康/);
  const growth = pagesSource['/growth'].html;
  for (const brand of ['八马茶业', '康师傅', '立白', '卫龙']) {
    assert.ok(growth.includes(brand), `流量赋能页缺少战报品牌：${brand}`);
  }
  const academy = pagesSource['/academy'].html;
  for (const name of ['AI 电商', 'AIGC', 'AI 漫剧', '大数据工程师']) {
    assert.ok(academy.includes(name), `集智商学院缺少课程方向：${name}`);
  }
  const empower = pagesSource['/empower'].html;
  for (const module of ['空间', '智能体', '算力', '学院', '企业', '订单', '流量', '资本']) {
    assert.ok(empower.includes(module), `八大赋能缺少模块：${module}`);
  }
});

test('动态区块的 data-opc-block 标记在目标页恰好出现一次', () => {
  const expected: Record<string, string[]> = {
    '/': ['home-stats', 'home-news', 'home-banners'],
    '/about': ['partners', 'partner-grid'],
    '/academy': ['course-grid'],
    '/news': ['news-list'],
    '/agent': ['agent-grid'],
  };
  for (const [path, markers] of Object.entries(expected)) {
    for (const marker of markers) {
      const hits = (pagesSource[path].html.match(new RegExp(`data-opc-block="${marker}"`, 'g')) ?? []).length;
      assert.equal(hits, 1, `${path} 的 ${marker} 标记应恰好一次（实际 ${hits}）`);
    }
  }
  // 没有动态区块的页面不得带标记（/market 的社区供需榜已于 2026-11-10 下线）
  for (const path of ['/health', '/empower', '/growth', '/apply', '/market']) {
    assert.ok(!pagesSource[path].html.includes('data-opc-block'), `${path} 不应有动态区块标记`);
  }
});

test('需要接后台的交互节点（表单 / 智能体目录）在产物里唯一存在', () => {
  const idsOf = (path: string) =>
    new Set([...pagesSource[path].html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  // join-* 是 7 个必填控件的 label 关联 id（编译期 wireJoinFormLabels），
  // 与交互节点一并断言唯一存在。
  assert.deepEqual([...idsOf('/apply')].sort(), [
    'join-contact', 'join-intro', 'join-size', 'join-team', 'join-tel', 'join-track', 'join-type',
    'joinForm', 'joinOk',
  ]);
  assert.deepEqual([...idsOf('/agent')].sort(), ['agentChips', 'agentCount', 'agentGrid', 'agentMore', 'agentSearch']);
  // need-*/give-* 是供需两表单的 label 关联 id（编译期 wireMarketFormLabels，
  // 两表单同名不同义，前缀按表单区分）。
  assert.deepEqual([...idsOf('/market')].sort(), [
    'give-boundary', 'give-contact', 'give-oneline', 'give-org', 'give-price',
    'give-product', 'give-scope', 'give-tel', 'give-when',
    'need-budget', 'need-contact', 'need-detail', 'need-oneline', 'need-org',
    'need-tel', 'need-when',
    'publish', 'sdCopy', 'sdGive', 'sdNeed', 'sdOut', 'sdText',
  ]);
});

test('供需页初始只展示供给表单，需求表单与结果卡保留 hidden 状态', () => {
  const html = pagesSource['/market'].html;
  const need = /<form\b[^>]*id="sdNeed"[^>]*>/.exec(html)?.[0] ?? '';
  const give = /<form\b[^>]*id="sdGive"[^>]*>/.exec(html)?.[0] ?? '';
  const out = /<div\b[^>]*id="sdOut"[^>]*>/.exec(html)?.[0] ?? '';
  assert.match(need, /\shidden(?:=|\s|>)/, '需求表单初始必须隐藏');
  assert.doesNotMatch(give, /\shidden(?:=|\s|>)/, '供给表单初始必须展示');
  assert.match(out, /\shidden(?:=|\s|>)/, '结果卡初始必须隐藏');
});

test('供需结果卡不再宣称是静态演示，说明与真实后台提交一致', () => {
  const html = pagesSource['/market'].html;
  assert.ok(!html.includes('这是静态演示版'));
  assert.ok(html.includes('运营审核'));
});

test('供需首屏 CTA 与双 Tab 一一对应（#publish-need / #publish-give）', () => {
  // 2026-11-11 修复入口错位：两个 CTA 原本都指向 #publish，落在默认的供给 Tab。
  const html = pagesSource['/market'].html;
  assert.ok(html.includes('href="#publish-need">我要发布需求'), '需求 CTA 应指向 #publish-need');
  assert.ok(html.includes('href="#publish-give">我能提供能力'), '能力 CTA 应指向 #publish-give');
  // 不得残留无语义的 #publish 直链；区块滚动锚点 id="publish" 本身保留
  assert.ok(!html.includes('href="#publish">'), 'CTA 不得再直链 #publish');
});

test('供需两表单的 label for / id 关联按表单前缀配对', () => {
  // 2026-11-11 与入驻表单同类的读屏可访问性修复：
  // 两表单同名不同义（need.org ≠ give.org），前缀按表单区分。
  const html = pagesSource['/market'].html;
  const forms = [...html.matchAll(/<form\b[^>]*id="(sdNeed|sdGive)"[^>]*>([\s\S]*?)<\/form>/g)];
  assert.equal(forms.length, 2, '供需两表单必须都在');
  const EXPECTED = {
    sdNeed: ['org', 'oneline', 'contact', 'tel', 'detail', 'budget', 'when'],
    sdGive: ['org', 'oneline', 'contact', 'tel', 'product', 'boundary', 'price', 'when', 'scope'],
  };
  for (const [, formId, body] of forms) {
    const prefix = formId === 'sdNeed' ? 'need-' : 'give-';
    for (const name of EXPECTED[formId as 'sdNeed' | 'sdGive']) {
      assert.ok(body.includes(`<label for="${prefix}${name}">`), `${formId} 的 ${name} 缺 label for`);
      assert.ok(body.includes(`id="${prefix}${name}"`), `${formId} 的 ${name} 缺控件 id`);
    }
    // 关联 id 不越界：恰好覆盖字段集
    const wired = [...body.matchAll(/\sid="(need|give)-(\w+)"/g)].map((m) => m[2]);
    assert.deepEqual([...new Set(wired)].sort(), [...EXPECTED[formId as 'sdNeed' | 'sdGive']].sort());
  }
});

test('供需提交按钮文案为「提交」，且不再有发布免费提示', () => {
  // 2026-11-11 需求：生成发布卡片 → 提交；删除按钮旁两条免费口径提示。
  const html = pagesSource['/market'].html;
  const buttons = [...html.matchAll(/<button type="submit"[^>]*>([^<]*)/g)].map((m) => m[1]);
  assert.deepEqual(buttons, ['提交', '提交']);
  assert.ok(!html.includes('生成发布卡片'), '旧按钮文案不得残留');
  assert.ok(!html.includes('sdacts__hint'), '免费提示 span 应整体删除');
  assert.ok(!html.includes('不成交不收费') && !html.includes('上架不收坑位费'), '两条免费口径不得残留');
  // 页首 lead 段落的「发布免费，社区内撮合…」是另一段文案，不属于本次删除范围
  assert.ok(html.includes('发布免费，社区内撮合'), '页首 lead 文案不应被误删');
});

test('供需手机号错误提示与服务端口径一致（11 位手机号）', () => {
  // 服务端 validateContact 按 /^1[3-9]\d{9}$/ 校验（contactType=phone），
  // 原提示「请填写联系方式」与实际校验不符——改成准确口径。
  const html = pagesSource['/market'].html;
  assert.equal((html.match(/请填写有效的 11 位手机号/g) ?? []).length, 2, '两表单各一条');
  assert.ok(!html.includes('请填写联系方式'), '旧口径不得残留');
});

test('入驻同意条款的公约与入驻须知可打开（链接 /agreement 锚点）', () => {
  // 2026-11-11 修复协议不可见：勾选文案里的两份文件此前全站无处可看。
  const html = pagesSource['/apply'].html;
  assert.ok(
    html.includes('<a href="/agreement#covenant" target="_blank" rel="noopener noreferrer">《集智 AI OPC 空间使用公约》</a>'),
    '公约应链接到 /agreement#covenant 并新开标签页',
  );
  assert.ok(
    html.includes('<a href="/agreement#notice" target="_blank" rel="noopener noreferrer">入驻须知</a>'),
    '入驻须知应链接到 /agreement#notice 并新开标签页',
  );
  // 承载页（React 静态页，不进烘焙产物）必须真的有这两个锚点
  const agreementPage = readFileSync('src/app/agreement/page.tsx', 'utf8');
  assert.ok(agreementPage.includes('id="covenant"'), '/agreement 缺 #covenant 锚点');
  assert.ok(agreementPage.includes('id="notice"'), '/agreement 缺 #notice 锚点');
});

test('入驻表单 7 个必填控件都有 label for / id 关联', () => {
  // 2026-11-11 修复读屏可访问性：label 原本是控件兄弟节点且无 for，accessible name 为空。
  const html = pagesSource['/apply'].html;
  const controls = [...html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)].map((match) => match[2]);
  for (const name of ['type', 'team', 'contact', 'tel', 'track', 'size', 'intro']) {
    const control = controls.find((attrs) => attrs.includes(`name="${name}"`));
    assert.ok(control, `控件 name=${name} 不存在`);
    assert.ok(control?.includes(`id="join-${name}"`), `控件 name=${name} 缺 id="join-${name}"`);
    assert.ok(html.includes(`<label for="join-${name}">`), `控件 name=${name} 缺 label for`);
  }
  // join-* 关联 id 恰好 7 个，不蔓延到其它控件
  assert.equal((html.match(/\sid="join-\w+"/g) ?? []).length, 7);
});

test('入驻结果提示位于表单外，成功隐藏表单后仍然可见', () => {
  const html = pagesSource['/apply'].html;
  const formStart = html.indexOf('id="joinForm"');
  const formEnd = html.indexOf('</form>', formStart);
  const result = html.indexOf('id="joinOk"');
  assert.ok(formStart >= 0 && formEnd > formStart, '入驻表单必须完整存在');
  assert.ok(result > formEnd, '结果提示不能位于成功后会被隐藏的表单内部');
});

test('新闻筛选项与后台允许的分类完全一致', () => {
  const filters = [...pagesSource['/news'].html.matchAll(/data-news-filter="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(filters, ['all', '行业观察', '政策资讯', '赛事活动']);
});

test('/news 列表底部不再渲染「订阅提示卡」', () => {
  // 参考站原文在列表下方有一张「资讯由社区运营团队维护……留下联系方式」的卡片，
  // 用户 2026-11-10 要求删掉该布局（编译期 removeNewsSubscribeCard）。
  const html = pagesSource['/news'].html;
  assert.ok(!html.includes('资讯由社区运营团队维护'), '/news 不应残留订阅提示文案');
  assert.ok(!html.includes('留下联系方式'), '/news 不应残留订阅按钮');
  // 卡片整块被移除：不得留下孤立的空卡片容器
  assert.ok(!html.includes('background:#F7FAFF'), '/news 不应残留该卡片容器');
  // 列表本身必须完好
  assert.ok(html.includes('class="newslist"'), '动态列表容器必须保留');
  assert.ok(html.includes('class="nitem rv"'), '动态条目必须保留');
});
