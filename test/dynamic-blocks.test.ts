/**
 * 公开站区块运行时化层（lib/opc/blocks-runtime + lib/opc/dom）的契约测试。
 *
 * ── 2026-11-10 全站复刻后语义（DB 唯一事实源，烘焙兜底移除）────────────
 *   1. 定位方式从「旧站的 class 锚点 + 正则配平」换成
 *      **编译期打的 data-opc-block 标记**（src/lib/opc/dom.ts）：
 *      - replaceBlockInner(html, marker, tagName, buildInner)：按标记定位容器，
 *        按标签配平找到闭标签，**只换内部**（容器自身的标签与属性保留）；
 *      - replaceElementInnerById(html, id, tagName, buildInner)：按 id 定位单元素；
 *      - 标记缺失 / 闭标签不完整 → **原样返回**（外壳完整性保护，绝不截断页面）；
 *   2. DB 行 → 区块渲染成参考站的类名（.hstat / .ncard / .ac-crs__i /
 *      .partner-wall__i / .acard / .sd-card）；
 *   3. 空数组 / 未配库 / 查询异常 → 区块**置空**（容器保留、内容清空；
 *      /agent 例外——重建为「全部」chip + 计数 0 + 空网格）；
 *   4. 后台可控的文本一律 escapeText 转义；图片 URL 只允许 https 外链或根相对路径。
 *
 * 删除的旧断言（逐条说明）：
 *   - 「replaceBalancedBlock 的正则锚点 + 括号配平」→ 实现已换成
 *     replaceBlockInner / replaceElementInnerById（标记驱动），旧 API 已删除；
 *   - 「旧站烘焙卡结构（hero-stat / opc-academy-course-card / supply-card /
 *     demand-card / tool-card / data-opc-agent-group）」→ 参考站的类名体系；
 *   - 「烘焙 233 张工具卡 / 22 条供需 / 16 家合作企业被清空」→ 参考站快照
 *     本身没有这些卡（目录/课程/伙伴/供需全部由 DB 接管）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyAgentTools,
  applyCourseGrid,
  applyHomeNews,
  applyHomeStats,
  applyMarketItems,
  applyPartnerGrid,
  type AgentRow,
  type CourseRow,
  type HomeNewsRow,
  type MarketItemRow,
  type PartnerRow,
  type StatRow,
} from '@/lib/opc/blocks-runtime';
import { replaceBlockInner, replaceElementInnerById } from '@/lib/opc/dom';
import { getReplicaPage } from '@/lib/opc/content';

const homeHtml = getReplicaPage('/')?.html ?? '';
const aboutHtml = getReplicaPage('/about')?.html ?? '';
const academyHtml = getReplicaPage('/academy')?.html ?? '';
const agentHtml = getReplicaPage('/agent')?.html ?? '';
const marketHtml = getReplicaPage('/market')?.html ?? '';

/* ── DOM 定位原语 ─────────────────────────────────────────────────────── */

describe('DOM 定位原语 · replaceBlockInner / replaceElementInnerById', () => {
  test('嵌套容器下配平到正确的闭标签，只换内部', () => {
    const html = '<p>x</p><div class="blk" data-opc-block="m" style="s"><div><span>a</span></div><i>b</i></div><p>y</p>';
    const out = replaceBlockInner(html, 'm', 'div', () => 'NEW');
    assert.equal(out, '<p>x</p><div class="blk" data-opc-block="m" style="s">NEW</div><p>y</p>');
  });

  test('容器自身的标签与属性保留（只有内部被替换）', () => {
    const html = '<div class="hero__stats" style="text-align:center" data-opc-block="home-stats">OLD</div>';
    const out = replaceBlockInner(html, 'home-stats', 'div', () => 'NEW');
    assert.equal(out, '<div class="hero__stats" style="text-align:center" data-opc-block="home-stats">NEW</div>');
  });

  test('标记不存在 → 原样返回', () => {
    const html = '<div>ok</div>';
    assert.equal(replaceBlockInner(html, 'nope', 'div', () => 'x'), html);
    assert.equal(replaceBlockInner('<div class="blk">', 'blk', 'span', () => 'x'), '<div class="blk">');
  });

  test('闭标签不完整 → 原样返回（绝不截断页面）', () => {
    const html = '<div class="blk" data-opc-block="m"><div><span>未闭合</div>';
    assert.equal(replaceBlockInner(html, 'm', 'div', () => 'x'), html);
  });

  test('标签名不匹配 → 原样返回', () => {
    const html = '<ul data-opc-block="m"><li>x</li></ul>';
    assert.equal(replaceBlockInner(html, 'm', 'div', () => 'x'), html);
  });

  test('replaceElementInnerById 按 id 替换内部，id 不存在则原样返回', () => {
    const html = '<p>共 <b id="agentCount" style="color:#0D2B6E">233</b> 个匹配结果</p>';
    assert.equal(
      replaceElementInnerById(html, 'agentCount', 'b', () => '7'),
      '<p>共 <b id="agentCount" style="color:#0D2B6E">7</b> 个匹配结果</p>',
    );
    assert.equal(replaceElementInnerById(html, 'nope', 'b', () => '7'), html);
  });

  test('replaceElementInnerById 闭标签缺失 → 原样返回', () => {
    const html = '<b id="agentCount">233';
    assert.equal(replaceElementInnerById(html, 'agentCount', 'b', () => '7'), html);
  });
});

describe('烘焙产物前提守卫（标记定位的地基）', () => {
  test('目标页的区块标记恰好出现一次', () => {
    const expected: Array<[string, string]> = [
      ['/', 'home-stats'],
      ['/', 'home-news'],
      ['/about', 'partner-grid'],
      ['/academy', 'course-grid'],
      ['/news', 'news-list'],
      ['/agent', 'agent-grid'],
      ['/market', 'market-supply'],
      ['/market', 'market-demand'],
    ];
    for (const [path, marker] of expected) {
      const html = getReplicaPage(path)?.html ?? '';
      const hits = (html.match(new RegExp(`data-opc-block="${marker}"`, 'g')) ?? []).length;
      assert.equal(hits, 1, `${path} 的 ${marker} 标记应恰好一次（实际 ${hits}）`);
    }
  });

  test('按 id 定位的节点在产物里唯一存在', () => {
    for (const [path, id] of [
      ['/agent', 'agentChips'],
      ['/agent', 'agentCount'],
      ['/agent', 'agentGrid'],
      ['/market', 'sdNeed'],
      ['/market', 'sdGive'],
      ['/apply', 'joinForm'],
    ] as const) {
      const html = getReplicaPage(path)?.html ?? '';
      const hits = (html.match(new RegExp(`id="${id}"`, 'g')) ?? []).length;
      assert.equal(hits, 1, `${path} 的 #${id} 应恰好一次（实际 ${hits}）`);
    }
  });

  test('被运行时整体替换的区块容器只允许 div/ul（配平算法的标签前提）', () => {
    // 只有这些标记会被 replaceBlockInner 整体替换内部，
    // 因此它们的容器标签必须是配平算法支持的 div / ul。
    // 其余标记（partners / market-board / market-items）是**外层包裹**，
    // 运行期不碰它们的内部。
    const replaced = ['home-stats', 'home-news', 'course-grid', 'partner-grid', 'news-list', 'agent-grid', 'market-supply', 'market-demand'];
    const pages = JSON.parse(readFileSync('src/lib/opc/generated/pages.json', 'utf8')) as Record<
      string,
      { html: string }
    >;
    for (const page of Object.values(pages)) {
      for (const match of page.html.matchAll(/<(\w+)\b[^>]*\bdata-opc-block="([^"]+)"/g)) {
        if (!replaced.includes(match[2])) continue;
        assert.ok(['div', 'ul'].includes(match[1]), `动态区块容器只允许 div/ul，实际 ${match[1]}（${match[2]}）`);
      }
    }
  });
});

/* ── 首页统计数字墙 ────────────────────────────────────────────────────── */

describe('首页统计数字墙 · applyHomeStats', () => {
  test('DB 行渲染成 .hstat 卡（value + suffix + label）', () => {
    const rows: StatRow[] = [
      { value: 233, suffix: '+', label: '入驻智能体' },
      { value: 88, suffix: '家', label: '合作企业' },
    ];
    const out = applyHomeStats(homeHtml, rows);
    assert.ok(out.includes('hero__stats'), '容器类名必须在');
    assert.ok(out.includes('data-opc-block="home-stats"'), '容器标记必须在');
    assert.ok(out.includes('<div class="hstat"><b>233<i>+</i></b><span>入驻智能体</span></div>'));
    assert.ok(out.includes('<div class="hstat"><b>88家</b><span>合作企业</span></div>'));
    assert.equal((out.match(/class="hstat"/g) ?? []).length, 2, '卡数应等于 DB 行数');
  });

  test('后缀里的符号单独着色，单位留在数字后', () => {
    const out = applyHomeStats(homeHtml, [{ value: 10, suffix: '++', label: '机构' }]);
    assert.ok(out.includes('<b>10<i>++</i></b>'), out.slice(out.indexOf('hstat'), out.indexOf('hstat') + 120));
  });

  test('标签文本转义（XSS 不落 DOM）', () => {
    const rows: StatRow[] = [{ value: 1, suffix: null, label: '<script>alert(1)</script>' }];
    const out = applyHomeStats(homeHtml, rows);
    assert.ok(!out.includes('<script>alert'), '原始标签不得进入 HTML');
    assert.ok(out.includes('&lt;script&gt;'));
  });

  test('空数组 → 统计墙置空（容器与标签保留，内容清空）', () => {
    const out = applyHomeStats(homeHtml, []);
    assert.ok(out.includes('hero__stats'), '容器必须在');
    assert.ok(out.includes('data-opc-block="home-stats"'), '容器标记必须在');
    assert.equal((out.match(/class="hstat"/g) ?? []).length, 0);
  });
});

/* ── 首页社区动态四卡 ──────────────────────────────────────────────────── */

describe('首页社区动态四卡 · applyHomeNews', () => {
  const rows: HomeNewsRow[] = [
    { slug: 's1', title: '标题一', summary: '摘要一', category: '行业观察', published_at: '2026-11-02' },
    { slug: 's2', title: '标题二', summary: '摘要二', category: '行业观察', published_at: '2026-11-03' },
    { slug: 's3', title: '标题三', summary: '摘要三', category: '行业观察', published_at: '2026-11-04' },
    { slug: 's4', title: '标题四', summary: '摘要四', category: '政策资讯', published_at: '2026-11-05' },
    { slug: 's5', title: '标题五', summary: '摘要五', category: '赛事活动', published_at: '2026-11-06' },
  ];

  test('DB 行渲染成 .ncard 卡（标题 / 类目 / 日期 / 摘要）', () => {
    const out = applyHomeNews(homeHtml, rows);
    assert.ok(out.includes('data-opc-block="home-news"'), '容器标记必须在');
    assert.ok(out.includes('<h3>标题一</h3>'));
    assert.ok(out.includes('<span class="ntag">行业观察</span>'));
    assert.ok(out.includes('<span class="ncard__date">2026-11-02</span>'));
    assert.ok(out.includes('<p>摘要一</p>'));
    assert.ok(out.includes('href="/newsdetail?id=s1"'), '卡片链接到详情页');
    assert.ok(out.includes('data-news-cat="行业观察"'), '类目标记供前端筛选');
  });

  test('最多 4 条（超出部分丢弃）', () => {
    const out = applyHomeNews(homeHtml, rows);
    assert.equal((out.match(/class="ncard rv vis"/g) ?? []).length, 4);
    assert.ok(!out.includes('标题五'), '第 5 条不得渲染');
  });

  test('空数组 → 四卡区置空（容器保留）', () => {
    const out = applyHomeNews(homeHtml, []);
    assert.ok(out.includes('data-opc-block="home-news"'), '容器必须在');
    assert.equal((out.match(/class="ncard rv vis"/g) ?? []).length, 0);
  });

  test('标题 / 摘要转义（XSS 不落 DOM）', () => {
    const out = applyHomeNews(homeHtml, [
      { slug: 'x', title: '<script>alert(1)</script>', summary: '<img src=x onerror=alert(2)>', category: '<b>', published_at: '2026-11-02' },
    ]);
    assert.ok(!out.includes('<script'), '不得出现真实的 script 标签');
    // 事件属性只允许出现在**标签内部**；转义后的文本不算
    assert.doesNotMatch(out, /<[a-zA-Z][^>]*\son[a-z]+\s*=/i);
    assert.ok(out.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(out.includes('&lt;img src=x onerror=alert(2)&gt;'));
  });
});

/* ── 集智商学院课程体系 ────────────────────────────────────────────────── */

describe('集智商学院课程卡 · applyCourseGrid', () => {
  test('DB 课程生成 .ac-crs__i 卡', () => {
    const rows: CourseRow[] = [
      { title: 'AI 电商运营从 0 到 1', summary: '选品、内容与店铺智能运营', track: 'AI电商', cover_url: null },
      { title: '外部封面课', summary: '摘要', track: '不存在方向', cover_url: 'https://cdn.example.com/a.png' },
    ];
    const out = applyCourseGrid(academyHtml, rows);
    assert.ok(out.includes('data-opc-block="course-grid"'), '网格容器必须在');
    assert.ok(out.includes('<h3>AI 电商运营从 0 到 1</h3>'));
    assert.ok(out.includes('<span class="tag">AI电商</span>'));
    assert.ok(out.includes('src="https://cdn.example.com/a.png"'), '合法 https 封面要用');
    assert.equal((out.match(/class="ac-crs__i rv vis"/g) ?? []).length, 2, '卡数等于 DB 行数');
  });

  test('非法封面协议回落占位图（javascript: 不进 src）', () => {
    const rows: CourseRow[] = [{ title: 't', summary: 's', track: 'AI电商', cover_url: 'javascript:alert(1)' }];
    const out = applyCourseGrid(academyHtml, rows);
    assert.ok(!out.includes('javascript:'), '非法协议不得进入 src');
    assert.ok(out.includes('/opc/reference/img/course-aigc.jpg'), '应回落站内占位图');
  });

  test('空数组 → 课程网格置空（容器保留）', () => {
    const out = applyCourseGrid(academyHtml, []);
    assert.ok(out.includes('data-opc-block="course-grid"'), '容器必须在');
    assert.equal((out.match(/class="ac-crs__i rv vis"/g) ?? []).length, 0);
  });
});

/* ── 生态伙伴墙 ────────────────────────────────────────────────────────── */

describe('生态伙伴墙 · applyPartnerGrid', () => {
  test('合法 logo 生成 .partner-wall__i 图片卡', () => {
    const rows: PartnerRow[] = [{ name: '宇树', logo_url: '/opc/reference/img/logo-icon.png' }];
    const out = applyPartnerGrid(aboutHtml, rows);
    assert.ok(out.includes('data-opc-block="partner-grid"'), '伙伴墙容器必须在');
    assert.ok(out.includes('<li class="partner-wall__i"><img src="/opc/reference/img/logo-icon.png" alt="宇树"'));
  });

  test('无 logo → 文字卡（伙伴名仍然上墙）', () => {
    const out = applyPartnerGrid(aboutHtml, [{ name: '无图伙伴', logo_url: null }]);
    assert.ok(out.includes('<li class="partner-wall__i"><span class="partner-wall__txt">无图伙伴</span></li>'));
  });

  test('非法 logo 的行不得把危险 URL 带进 src', () => {
    // ⚠️ 实际实现（src/lib/opc/blocks-runtime.ts 的 applyPartnerGrid）：
    // 非法 logo 与无 logo 同义 —— 回落成**文字卡**，而不是丢弃这一行。
    // 丢弃的只有「名字为空」的行。断言按实现逐字锁死，并额外锁住安全属性。
    const out = applyPartnerGrid(aboutHtml, [{ name: '坏协议', logo_url: 'javascript:x' }]);
    assert.ok(!out.includes('javascript:'), '非法协议不得进入 HTML');
    assert.ok(!/<img[^>]*src="javascript/i.test(out));
    assert.ok(out.includes('<span class="partner-wall__txt">坏协议</span>'), '非法 logo 回落文字卡');
  });

  test('名字为空的行被跳过（空白墙不留空卡）', () => {
    const out = applyPartnerGrid(aboutHtml, [
      { name: '   ', logo_url: '/opc/reference/img/logo-icon.png' },
      { name: '正常伙伴', logo_url: '/opc/reference/img/logo-icon.png' },
    ]);
    assert.equal((out.match(/class="partner-wall__i"/g) ?? []).length, 1);
    assert.ok(out.includes('正常伙伴'));
  });

  test('空数组 → 伙伴墙置空（容器保留）', () => {
    const out = applyPartnerGrid(aboutHtml, []);
    assert.ok(out.includes('data-opc-block="partner-grid"'), '容器必须在');
    assert.equal((out.match(/class="partner-wall__i"/g) ?? []).length, 0);
  });
});

/* ── /agent 智能体目录 ─────────────────────────────────────────────────── */

describe('/agent 智能体目录 · applyAgentTools', () => {
  const rows: AgentRow[] = [
    { name: '验收智能体A', category: 'office', summary: '办公类验收', external_url: 'https://tool-a.example.com', icon_url: null },
    { name: '验收智能体B', category: 'coding', summary: '编程类验收', external_url: 'https://tool-b.example.com/path', icon_url: '/opc/reference/img/logo-icon.png' },
    { name: '坏链接', category: 'office', summary: 's', external_url: 'http://insecure.example.com', icon_url: null },
  ];

  test('重建 chips（data-cat = 分类 slug）+ agentCount + 网格', () => {
    const out = applyAgentTools(agentHtml, rows);
    // chips：全部(active) + 办公 + 编程；data-cat 用的是**后台分类 slug**（与 agent_categories 表一致）
    const chips = [...out.matchAll(/<button class="chip[^"]*"[^>]*data-cat="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(chips, ['all', 'office', 'coding']);
    // chip 文案是分类中文名
    assert.ok(out.includes('data-cat="office" aria-pressed="false">办公'));
    assert.ok(out.includes('data-cat="all" aria-pressed="true">全部'));
    // 计数
    assert.ok(out.includes('id="agentCount" style="color:#0D2B6E">2</b> 个匹配结果'));
    // 网格：卡片带同源的 data-opc-categories（slug）
    assert.ok(out.includes('data-opc-categories="office"'));
    assert.ok(out.includes('href="https://tool-b.example.com/path"'));
    assert.ok(out.includes('rel="noopener noreferrer"'));
    assert.equal((out.match(/class="acard"/g) ?? []).length, 2, 'http 外链的行被剔除');
  });

  test('chips 的 data-cat 与卡片的 data-opc-categories 同源（都是分类 slug）', () => {
    const out = applyAgentTools(agentHtml, rows);
    const chipSlugs = new Set([...out.matchAll(/<button class="chip[^"]*"[^>]*data-cat="([^"]+)"/g)].map((m) => m[1]));
    const cardSlugs = new Set([...out.matchAll(/data-opc-categories="([^"]+)"/g)].map((m) => m[1]));
    for (const slug of cardSlugs) {
      assert.ok(chipSlugs.has(slug), `卡片分类 ${slug} 没有对应的 chip`);
      assert.ok(!/[一-龥]/.test(slug), `分类必须是 slug 而不是中文名：${slug}`);
    }
  });

  test('空库 → 「全部」chip + 计数 0 + 空网格', () => {
    const out = applyAgentTools(agentHtml, []);
    const chips = [...out.matchAll(/<button class="chip[^"]*"[^>]*data-cat="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(chips, ['all']);
    assert.ok(out.includes('>全部 <span style="opacity:.7">0</span>'));
    assert.ok(out.includes('id="agentCount" style="color:#0D2B6E">0</b> 个匹配结果'));
    assert.equal((out.match(/class="acard"/g) ?? []).length, 0, '网格必须为空');
  });

  test('全部行外链不合法 → 同样重建为空目录', () => {
    const noLink = applyAgentTools(agentHtml, [{ name: 'x', category: 'office', summary: '', external_url: null, icon_url: null }]);
    assert.ok(noLink.includes('id="agentCount" style="color:#0D2B6E">0</b> 个匹配结果'));
    assert.equal((noLink.match(/class="acard"/g) ?? []).length, 0);
  });

  test('非 https 外链的行被剔除（不进 DOM）', () => {
    const out = applyAgentTools(agentHtml, rows);
    assert.ok(!out.includes('insecure.example.com'));
    assert.ok(!out.includes('坏链接'));
  });

  test('名称 / 摘要转义（XSS 不落 DOM）', () => {
    const hostile = applyAgentTools(agentHtml, [
      { name: '<script>alert(1)</script>', category: 'office', summary: '"onload="alert(2)', external_url: 'https://ok.example.com', icon_url: null },
    ]);
    assert.doesNotMatch(hostile, /<script\b/i);
    assert.ok(hostile.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  });

  test('未知分类 slug 回落用 slug 原文做 chip 文案', () => {
    const out = applyAgentTools(agentHtml, [
      { name: 'x', category: 'not-a-real-slug', summary: '', external_url: 'https://ok.example.com', icon_url: null },
    ]);
    assert.ok(out.includes('data-cat="not-a-real-slug"'), '未知 slug 仍保留同源分组');
  });
});

/* ── /market 社区供需榜 ────────────────────────────────────────────────── */

describe('/market 社区供需榜 · applyMarketItems', () => {
  const rows: MarketItemRow[] = [
    { type: 'supply', title: '验收供给服务', summary: '供给摘要', org_name: '验收科技', tags: ['AI客服', '外包'], published_at: '2026-10-20' },
    { type: 'demand', title: '验收需求项目', summary: '需求摘要', org_name: null, tags: ['小程序'], published_at: '2026-10-26' },
  ];

  test('供给 / 需求两区各自替换，卡片结构与参考站一致', () => {
    const out = applyMarketItems(marketHtml, rows);
    assert.ok(out.includes('data-opc-block="market-supply"'));
    assert.ok(out.includes('data-opc-block="market-demand"'));
    assert.ok(out.includes('<article class="sd-card">'));
    assert.ok(out.includes('<h3>验收供给服务</h3>'));
    assert.ok(out.includes('<b>验收科技</b>'));
    assert.ok(out.includes('<span>2026-10-20</span>'));
    assert.ok(out.includes('<h3>验收需求项目</h3>'));
    assert.ok(out.includes('<b>社区成员</b>'), '缺机构名回落「社区成员」');
    assert.ok(out.includes('<span class="tag">AI客服</span>'));
    assert.equal((out.match(/class="sd-card"/g) ?? []).length, 2);
  });

  test('只录一边 → 另一侧置空（DB 是唯一事实源）', () => {
    const onlySupply = applyMarketItems(marketHtml, [rows[0]]);
    assert.ok(onlySupply.includes('验收供给服务'));
    assert.ok(!onlySupply.includes('验收需求项目'), '需求区必须置空');
    assert.equal((onlySupply.match(/class="sd-card"/g) ?? []).length, 1);
    // 容器仍然在（只是空了）
    assert.ok(onlySupply.includes('data-opc-block="market-demand"'));
  });

  test('空数组 → 两区置空（容器保留）', () => {
    const out = applyMarketItems(marketHtml, []);
    assert.ok(out.includes('data-opc-block="market-supply"'), '供给区容器必须在');
    assert.ok(out.includes('data-opc-block="market-demand"'), '需求区容器必须在');
    assert.equal((out.match(/class="sd-card"/g) ?? []).length, 0);
  });

  test('标题为空的行被跳过', () => {
    const out = applyMarketItems(marketHtml, [{ ...rows[0], title: '  ' }]);
    assert.equal((out.match(/class="sd-card"/g) ?? []).length, 0);
  });

  test('timestamptz 按北京时间取日历日（UTC 前一天 16:00 = 北京次日 0 点）', () => {
    const out = applyMarketItems(marketHtml, [
      { type: 'demand', title: '时区验收', summary: '', org_name: 'T', tags: [], published_at: '2026-10-20T16:00:00+00:00' },
    ]);
    assert.ok(out.includes('<span>2026-10-21</span>'), 'timestamptz 应按 Asia/Shanghai 取日期');
    assert.ok(!out.includes('<span>2026-10-20</span>'), '不得显示 UTC 前一天');
  });

  test('非法日期 → 日期留空（不显示 Invalid Date）', () => {
    const out = applyMarketItems(marketHtml, [{ ...rows[0], published_at: '不是日期' }]);
    assert.ok(!out.includes('Invalid Date'));
    assert.ok(out.includes('<span></span>'));
  });

  test('标签最多 4 个，且文本转义', () => {
    const out = applyMarketItems(marketHtml, [
      { ...rows[0], tags: ['a', 'b', 'c', 'd', 'e', '<script>x</script>'] },
    ]);
    // 只看供需榜里的卡（页面其他位置也有 .tag）
    const card = out.slice(out.indexOf('data-opc-block="market-supply"'), out.indexOf('data-opc-block="market-demand"'));
    const tags = [...card.matchAll(/<span class="tag">([^<]*)<\/span>/g)].map((match) => match[1]);
    assert.deepEqual(tags, ['a', 'b', 'c', 'd']);
    assert.ok(!card.includes('<script>x</script>'));
  });
});
