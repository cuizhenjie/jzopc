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
  applyCourseGrid,
  applyHomeStats,
  applyPartnerGrid,
  replaceBalancedBlock,
  type CourseRow,
  type PartnerRow,
  type StatRow,
} from '@/lib/opc/blocks-runtime';
import { getReplicaPage } from '@/lib/opc/content';

const homeHtml = getReplicaPage('/')?.html ?? '';
const centerHtml = getReplicaPage('/center')?.html ?? '';

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

  test('四个目标页的区块锚点恰好出现一次，且 token 纯净、标签配平', () => {
    const anchors: Array<[string, RegExp]> = [
      ['/', /class="hero-stats-row/g],
      ['/', /class="opc-visual-partner-grid"/g],
      ['/center', /class="opc-academy-course-grid"/g],
      ['/market', /class="opc-visual-partner-grid"/g],
      ['/work', /class="opc-visual-partner-grid"/g],
    ];
    for (const [path, re] of anchors) {
      const html = getReplicaPage(path)?.html ?? '';
      const hits = (html.match(re) ?? []).length;
      assert.equal(hits, 1, `${path} 的区块锚点应恰好一次（实际 ${hits}），配平替换的定位前提`);
    }
    for (const path of ['/', '/center', '/market', '/work'] as const) {
      const html = getReplicaPage(path)?.html ?? '';
      assertTokenPurity(html, 'div');
      assertTokenPurity(html, 'ul');
    }
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
