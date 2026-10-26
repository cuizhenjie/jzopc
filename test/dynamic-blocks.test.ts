/**
 * 复刻区块运行时化层（lib/opc/blocks-runtime）的契约测试。
 *
 * 方式一（2026-10-26）核心语义：
 *   1. DB 行 → 区块替换后的 HTML 必须与烘焙卡**同结构**（类名/作用域属性不丢，
 *      否则参考 CSS 与设计层全部失配）；
 *   2. 空数组 / 不匹配结构 → **原样返回烘焙 HTML**（回落是区块级语义）；
 *   3. 后台可控的文本一律 escapeText 转义；图片 URL 只允许 https 外链或根相对路径。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAgentTools,
  applyCourseGrid,
  applyHomeStats,
  applyMarketItems,
  applyPartnerGrid,
  replaceBalancedBlock,
  type AgentRow,
  type CourseRow,
  type MarketItemRow,
  type PartnerRow,
  type StatRow,
} from '@/lib/opc/blocks-runtime';
import { getReplicaPage } from '@/lib/opc/content';

const homeHtml = getReplicaPage('/')?.html ?? '';
const centerHtml = getReplicaPage('/center')?.html ?? '';
const agentHtml = getReplicaPage('/agent')?.html ?? '';
const marketHtml = getReplicaPage('/market')?.html ?? '';

describe('括号配平替换 · replaceBalancedBlock', () => {
  test('嵌套 div 下配平到正确的闭标签，只换内部', () => {
    const html = '<p>x</p><div class="blk" style="s"><div><span>a</span></div><i>b</i></div><p>y</p>';
    const out = replaceBalancedBlock(html, /<div class="blk"[^>]*>/, ['<div', '</div>'], () => 'NEW');
    assert.equal(out, '<p>x</p><div class="blk" style="s">NEW</div><p>y</p>');
  });

  test('开标签不存在或闭标签不完整 → 原样返回', () => {
    assert.equal(replaceBalancedBlock('<div>ok</div>', /<div class="nope">/, ['<div', '</div>'], () => 'x'), '<div>ok</div>');
    assert.equal(replaceBalancedBlock('<div class="blk">', /<div class="blk">/, ['<div', '</div>'], () => 'x'), '<div class="blk">');
  });
});

describe('烘焙产物前提守卫（配平算法的地基）', () => {
  /** 字面计数（indexOf 语义）＝ 正则标签计数，意味着没有注释/属性值里藏着 token，
   *  replaceBalancedBlock 的字面配平在这些产物上是精确的。 */
  function assertTokenPurity(html: string, tag: 'div' | 'ul') {
    const literalOpen = html.split(`<${tag}`).length - 1;
    const literalClose = html.split(`</${tag}`).length - 1;
    const regexOpen = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length;
    const regexClose = (html.match(new RegExp(`</${tag}\\s*>`, 'g')) ?? []).length;
    assert.equal(literalOpen, regexOpen, `<${tag} 字面出现次数必须等于真实开标签数`);
    assert.equal(literalClose, regexClose, `</${tag}> 字面出现次数必须等于真实闭标签数`);
    assert.equal(literalOpen, literalClose, `开闭标签必须配平`);
  }

  test('目标页的区块锚点恰好出现一次，且 token 纯净、标签配平', () => {
    const anchors: Array<[string, RegExp]> = [
      ['/', /class="hero-stats-row/g],
      ['/', /class="opc-visual-partner-grid"/g],
      ['/center', /class="opc-academy-course-grid"/g],
      ['/market', /class="opc-visual-partner-grid"/g],
      ['/market', /class="supply-grid"/g],
      ['/market', /class="demand-grid"/g],
      ['/work', /class="opc-visual-partner-grid"/g],
      ['/agent', /class="filter-scroll"/g],
      ['/agent', /data-opc-agent-results/g],
    ];
    for (const [path, re] of anchors) {
      const html = getReplicaPage(path)?.html ?? '';
      const hits = (html.match(re) ?? []).length;
      assert.equal(hits, 1, `${path} 的区块锚点应恰好一次（实际 ${hits}），配平替换的定位前提`);
    }
    for (const path of ['/', '/center', '/market', '/work', '/agent'] as const) {
      const html = getReplicaPage(path)?.html ?? '';
      assertTokenPurity(html, 'div');
      assertTokenPurity(html, 'ul');
    }
  });
});

describe('/agent 智能体目录 · applyAgentTools', () => {
  const rows: AgentRow[] = [
    { name: '验收智能体A', category: 'office', summary: '办公类验收', external_url: 'https://tool-a.example.com', icon_url: null },
    { name: '验收智能体B', category: 'coding', summary: '编程类验收', external_url: 'https://tool-b.example.com/path', icon_url: '/opc/assets/tool-icons/x.png' },
    { name: '坏链接', category: 'office', summary: 's', external_url: 'http://insecure.example.com', icon_url: null },
  ];

  test('重建 chips 与分区；卡带 data-opc-categories（filter-tools 精确匹配契约）', () => {
    const out = applyAgentTools(agentHtml, rows);
    // chips：全部(active) + 办公 + 编程；烘焙 18 分类 chips 被替换
    const chips = [...out.matchAll(/data-opc-action="filter-tools" data-opc-value="([^"]*)"/g)].map((m) => m[1]);
    assert.deepEqual(chips, ['全部', '办公', '编程']);
    assert.ok(out.includes('data-opc-value="全部" aria-pressed="true"'));
    // 分区与状态行
    assert.ok(out.includes('data-opc-agent-group="办公"'));
    assert.ok(out.includes('data-opc-agent-group="编程"'));
    assert.ok(out.includes('共 2 个智能体'));
    // 卡片契约：categories JSON（转义后 &quot;）、搜索文本、域名、rel
    assert.ok(out.includes('data-opc-categories="[&quot;办公&quot;]"'));
    assert.ok(out.includes('href="https://tool-b.example.com/path"'));
    assert.ok(out.includes('<code data-v-199d00a7="" class="tc-domain">tool-b.example.com</code>'));
    assert.ok(out.includes('rel="noopener noreferrer"'));
    assert.ok(out.includes('class="tool-card revealed"'));
    // 装饰节点齐全（验收轮补齐 tc-border-glow，缺了会少一层默认可见的边框光晕）
    assert.ok(out.includes('class="tc-border-glow"'));
    assert.ok(out.includes('class="tc-glare"'));
    // http 外链的行被跳过
    assert.ok(!out.includes('insecure.example.com'));
    assert.ok(!out.includes('坏链接'));
    // 烘焙卡被替换（首张烘焙卡 LivePPT 不在了）
    assert.ok(!out.includes('LivePPT'));
  });

  test('空数组或全部行外链不合法 → 烘焙目录原样（233 卡）', () => {
    assert.equal(applyAgentTools(agentHtml, []), agentHtml);
    const noLink = applyAgentTools(agentHtml, [{ name: 'x', category: 'office', summary: '', external_url: null, icon_url: null }]);
    assert.equal(noLink, agentHtml);
    assert.equal((agentHtml.match(/class="tool-card/g) ?? []).length, 233);
  });
});

describe('/market 供需卡 · applyMarketItems', () => {
  const rows: MarketItemRow[] = [
    { type: 'supply', title: '验收供给服务', summary: '供给摘要', org_name: '验收科技', tags: ['AI客服', '外包'], published_at: '2026-10-20' },
    { type: 'demand', title: '验收需求项目', summary: '需求摘要', org_name: null, tags: ['小程序'], published_at: '2026-10-26' },
  ];

  test('供给/需求两区各自替换，卡片结构与日期口径对齐烘焙卡', () => {
    const out = applyMarketItems(marketHtml, rows);
    assert.ok(out.includes('class="sc-title">验收供给服务</h3>'));
    assert.ok(out.includes('class="sc-author-name">验收科技</span>'));
    assert.ok(out.includes('class="sc-date">2026/10/20</span>'));
    assert.ok(out.includes('href="/opcapply?formType=partner" class="sc-contact"'));
    assert.ok(out.includes('class="dc-title">验收需求项目</h3>'));
    assert.ok(out.includes('class="dc-user-info"><h4 data-v-18addbe5="">社区成员</h4>'));
    assert.ok(out.includes('class="dc-time">2026/10/26</span>'));
    // DB 卡不带 navigate（无详情页可去），烘焙卡的 navigate 不受影响
    assert.ok(!out.includes('data-opc-route="/newsdetail?id=0"'));
  });

  test('只录一边：供给有行换供给区，需求区维持烘焙卡', () => {
    const onlySupply = applyMarketItems(marketHtml, [rows[0]]);
    assert.ok(onlySupply.includes('验收供给服务'));
    assert.ok(onlySupply.includes('农资作物长势 AI 识别小程序开发'), '烘焙需求卡必须在');
  });

  test('空数组 → 两区烘焙原样（22 卡）', () => {
    assert.equal(applyMarketItems(marketHtml, []), marketHtml);
  });

  test('timestamptz 按北京时间取日历日（UTC 前一天 16:00 = 北京次日 0 点）', () => {
    const out = applyMarketItems(marketHtml, [
      { type: 'demand', title: '时区验收', summary: '', org_name: 'T', tags: [], published_at: '2026-10-20T16:00:00+00:00' },
    ]);
    // UTC 2026-10-20 16:00 = 北京 2026-10-21 00:00 → 应显示 2026/10/21 而非 10/20
    assert.ok(out.includes('2026/10/21'), 'timestamptz 应按 Asia/Shanghai 取日期');
    assert.ok(!out.includes('2026/10/20</span>'), '不得显示 UTC 前一天');
  });
});

describe('首页统计数字墙 · applyHomeStats', () => {
  test('DB 行替换数字与标签，容器类名与作用域属性保持', () => {
    const rows: StatRow[] = [
      { value: 233, suffix: '+', label: '入驻智能体' },
      { value: 88, suffix: ' 家', label: '合作企业' },
    ];
    const out = applyHomeStats(homeHtml, rows);
    assert.ok(out.includes('hero-stats-row'), '容器类名必须在');
    assert.ok(out.includes('>233+</span>'), '替换后的数字必须在');
    assert.ok(out.includes('>88 家</span>'), '非 + 前缀的后缀要留空格');
    assert.ok(out.includes('入驻智能体'));
    assert.ok(!out.includes('>500+</span>'), '烘焙的 500+ 必须被替换掉');
    const items = out.match(/class="hero-stat"/g) ?? [];
    assert.equal(items.length, 2, '条数应等于 DB 行数');
  });

  test('标签文本转义（XSS 不落 DOM）', () => {
    const rows: StatRow[] = [{ value: 1, suffix: null, label: '<script>alert(1)</script>' }];
    const out = applyHomeStats(homeHtml, rows);
    assert.ok(!out.includes('<script>alert'), '原始标签不得进入 HTML');
    assert.ok(out.includes('&lt;script&gt;'));
  });

  test('空数组 → 烘焙 HTML 原样', () => {
    assert.equal(applyHomeStats(homeHtml, []), homeHtml);
  });
});

describe('/center 课程方向卡 · applyCourseGrid', () => {
  test('DB 课程生成卡片，cover 缺失回落同 track 的烘焙配图', () => {
    const rows: CourseRow[] = [
      { title: 'AI 电商运营从 0 到 1', summary: '选品、内容与店铺智能运营', track: 'AI电商', cover_url: null },
      { title: '外部封面课', summary: 's', track: '不存在方向', cover_url: 'https://cdn.example.com/a.png' },
    ];
    const out = applyCourseGrid(centerHtml, rows);
    assert.ok(out.includes('opc-academy-course-grid'), '网格容器必须在');
    assert.ok(out.includes('<h3>AI 电商运营从 0 到 1</h3>'));
    assert.ok(out.includes('course-ai-ecommerce.webp'), 'track 命中要沿用烘焙配图');
    assert.ok(out.includes('src="https://cdn.example.com/a.png"'), '合法 https 封面要用');
    assert.equal((out.match(/opc-academy-course-card/g) ?? []).length, 2, '卡数等于 DB 行数');
  });

  test('非法封面协议（javascript:）被拒并回落烘焙图', () => {
    const rows: CourseRow[] = [{ title: 't', summary: 's', track: 'AI电商', cover_url: 'javascript:alert(1)' }];
    const out = applyCourseGrid(centerHtml, rows);
    assert.ok(!out.includes('javascript:'), '非法协议不得进入 src');
    assert.ok(out.includes('course-ai-ecommerce.webp'), '应回落 track 对应烘焙图');
  });

  test('空数组 → 烘焙五卡原样', () => {
    assert.equal(applyCourseGrid(centerHtml, []), centerHtml);
  });
});

describe('伙伴墙 · applyPartnerGrid', () => {
  test('合法 logo 生成卡片；无 logo / 非法 logo 的行跳过', () => {
    const rows: PartnerRow[] = [
      { name: '宇树', logo_url: '/opc/visual/partner-unitree.svg' },
      { name: '无图伙伴', logo_url: null },
      { name: '坏协议', logo_url: 'javascript:x' },
      { name: '外部', logo_url: 'https://cdn.example.com/logo.png' },
    ];
    const out = applyPartnerGrid(homeHtml, rows);
    assert.ok(out.includes('alt="宇树"'));
    assert.ok(out.includes('src="https://cdn.example.com/logo.png"'));
    assert.ok(!out.includes('无图伙伴'), '无合法 logo 的行不渲染（不做文字卡占位）');
    assert.ok(!out.includes('javascript:'));
    const cards = out.match(/opc-visual-partner-card/g) ?? [];
    assert.equal(cards.length, 2);
  });

  test('全部行都无合法 logo 或空数组 → 烘焙 16 家原样', () => {
    assert.equal(applyPartnerGrid(homeHtml, []), homeHtml);
    assert.equal(
      applyPartnerGrid(homeHtml, [{ name: 'x', logo_url: null }]),
      homeHtml,
    );
    assert.equal((applyPartnerGrid(homeHtml, []).match(/opc-visual-partner-card/g) ?? []).length, 16);
  });

  test('三页共用：供需页与工作页的烘焙墙同样可替换', () => {
    for (const path of ['/market', '/work'] as const) {
      const html = getReplicaPage(path)?.html ?? '';
      const out = applyPartnerGrid(html, [{ name: '测试伙伴', logo_url: '/opc/visual/partner-huawei.svg' }]);
      assert.ok(out.includes('alt="测试伙伴"'), `${path} 的伙伴墙应可替换`);
    }
  });
});
