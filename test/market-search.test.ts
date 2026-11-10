/**
 * 搜索 / 筛选与供需文案的契约测试（+ 旧路由 308 收敛守卫）。
 *
 * ── 为什么改写（2026-11-10 全站复刻后）──────────────────────────────────
 *
 * 旧版测的是旧站 `src/components/opc/interaction-model.ts` 的 facetMatches，
 * 以及旧站烘焙的 22 条供需卡 / 旧版原生页的 308 收敛表。
 *
 * 删除的旧断言（逐条说明）：
 *   - 「22 条公开供需全部带稳定 id 和类型 + filter-market 按钮」
 *     → 旧站供需卡结构（supply-card / demand-card / data-opc-action）已下线；
 *       参考站的供需榜由后台 market_items 表接管（.sd-card），且参考站页面
 *       本身没有烘焙供需卡 —— 无可比对的产物；
 *       （2026-11-10 起「社区供需榜」模块本身也已移除，详见下方断言）；
 *   - 「facetMatches（旧站供给/需求分类检索）」
 *     → 旧站的分类别名模型已随 interaction-model.ts 删除；
 *       智能体目录的新筛选规则是**分类 slug 同值比对**，见下；
 *   - 「旧版原生页下线表（/agents→/agent、/academy→/center、/news/:slug*→/newslist）」
 *     → 收敛表本身还在，但目标路由已换成参考站口径（/academy、/news），
 *       这里按新表逐条锁死。
 *
 * 新契约：
 *   1. 智能体目录的搜索 / 筛选（纯函数，可直接覆盖）；
 *   2. 供需发布表单的发布文案（纯函数，可直接覆盖）；
 *   3. 旧路由 308 收敛表不回潮；
 *   4. 站内不允许手写搜索输入框（筛选统一走参考站的 #agentSearch）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildMarketCardText,
  filterAgents,
  matchesAgentQuery,
  parseAgentCategories,
  type MarketFormValues,
} from '@/lib/opc/form-payload';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');

const config = read('next.config.ts');
const marketSrc = read('src/app/market/page.tsx');
const marketHtml = JSON.parse(read('src/lib/opc/generated/pages.json'))['/market'].html as string;

describe('智能体目录 · 搜索与筛选（纯函数）', () => {
  const cards = [
    { text: 'LivePPT AI 演示文稿', search: 'PPT 办公', categories: 'hot' },
    { text: 'AI 代码助手', search: '编程', categories: 'ai-coding' },
    { text: 'AI 写作助手', search: '写作', categories: 'ai-writing' },
  ];

  test('分类筛选：slug 同值比对，all 不限分类', () => {
    assert.equal(matchesAgentQuery(cards[0], 'hot', ''), true);
    assert.equal(matchesAgentQuery(cards[0], 'ai-coding', ''), false);
    assert.equal(matchesAgentQuery(cards[0], 'all', ''), true);
    // 未知分类命中 0 条
    assert.equal(filterAgents(cards, 'not-a-slug', '').length, 0);
  });

  test('关键词搜索：命中可见文本或 data-opc-search 文本', () => {
    assert.equal(matchesAgentQuery(cards[1], 'all', '代码'), true);
    assert.equal(matchesAgentQuery(cards[1], 'all', '编程'), true);
    assert.equal(matchesAgentQuery(cards[1], 'all', '不存在的关键词'), false);
  });

  test('分类与关键词可组合（两者都命中才保留）', () => {
    assert.deepEqual(filterAgents(cards, 'ai-coding', '编程').map((card) => card.text), ['AI 代码助手']);
    assert.deepEqual(filterAgents(cards, 'ai-coding', 'PPT'), []);
  });

  test('关键词大小写不敏感且前后空白被忽略', () => {
    assert.equal(matchesAgentQuery(cards[0], 'all', 'liveppt'), true);
    assert.equal(matchesAgentQuery(cards[0], 'all', '  PPT  '), true);
  });

  test('分类属性支持 JSON 数组与逗号分隔两种形态', () => {
    assert.deepEqual(parseAgentCategories('["a","b"]'), ['a', 'b']);
    assert.deepEqual(parseAgentCategories('a, b'), ['a', 'b']);
    assert.deepEqual(parseAgentCategories('a,,b'), ['a', 'b']);
    assert.deepEqual(parseAgentCategories(''), []);
  });

  test('空目录返回空数组（不抛错）', () => {
    assert.deepEqual(filterAgents([], 'all', ''), []);
  });
});

describe('供需发布表单 · 卡片文案（纯函数）', () => {
  const needValues: MarketFormValues = {
    org: '某某智能科技',
    oneline: 'AI 问诊助手',
    contact: '李四',
    tel: '13900139000',
    needTypes: ['找业务', '找资源'],
    detail: '连锁药店要 AI 问诊助手，需对接现有 ERP',
    budget: '10 万以内',
    when: '1 个月内',
    giveTypes: [],
    product: '',
    boundary: '',
    giveWays: [],
    price: '',
    scope: '社区内公开',
  };

  const giveValues: MarketFormValues = {
    ...needValues,
    needTypes: [],
    giveTypes: ['智能体开发', 'AIGC 内容'],
    product: '医药零售知识库智能体',
    boundary: '不含硬件采购',
    giveWays: ['项目制', '长期服务'],
    price: '面议',
  };

  test('需求文案逐行可预期', () => {
    const text = buildMarketCardText('need', needValues);
    assert.deepEqual(text.split('\n'), [
      '【需求】AI 问诊助手',
      '名称：某某智能科技',
      '类型：找业务 / 找资源',
      '要什么：连锁药店要 AI 问诊助手，需对接现有 ERP',
      '预算 / 方式：10 万以内',
      '时间：1 个月内',
      '公开范围：社区内公开',
      '联系：李四 13900139000',
    ]);
  });

  test('供给文案逐行可预期', () => {
    const text = buildMarketCardText('give', giveValues);
    assert.deepEqual(text.split('\n'), [
      '【供给】AI 问诊助手',
      '名称：某某智能科技',
      '能提供：智能体开发 / AIGC 内容',
      '产品与适合谁：医药零售知识库智能体',
      '合作边界：不含硬件采购',
      '合作方式：项目制 / 长期服务｜面议',
      '可响应：1 个月内',
      '公开范围：社区内公开',
      '联系：李四 13900139000',
    ]);
  });

  test('合作边界为空时整行省略（不留空行）', () => {
    const text = buildMarketCardText('give', { ...giveValues, boundary: '' });
    assert.ok(!text.includes('合作边界'));
    assert.equal(text.split('\n').length, 8);
  });

  test('需求与供给文案首行标签不同，不会混淆', () => {
    assert.ok(buildMarketCardText('need', needValues).startsWith('【需求】'));
    assert.ok(buildMarketCardText('give', giveValues).startsWith('【供给】'));
  });
});

describe('旧路由 308 收敛表（2026-11-10 参考站口径）', () => {
  test('全部下线跳转都在 next.config redirects() 里且为 308（permanent）', () => {
    const rules: Array<[string, string]> = [
      ['/center', '/academy'],
      ['/traffic', '/growth'],
      ['/newslist', '/news'],
      ['/activitylist', '/news'],
      ['/join', '/apply'],
      ['/orders', '/market'],
      ['/agents', '/agent'],
      ['/market/:slug', '/market'],
    ];
    for (const [source, destination] of rules) {
      assert.ok(config.includes(`source: '${source}'`), `收敛表缺少 source ${source}`);
      assert.ok(config.includes(`destination: '${destination}'`), `收敛表缺少 destination ${destination}`);
    }
    // 全部是 permanent（308），不是 307
    const redirects = config.slice(config.indexOf('async redirects()'));
    const entries = [...redirects.matchAll(/\{ source: '([^']+)', destination: '([^']+)', permanent: (\w+) \}/g)];
    assert.ok(entries.length >= rules.length, '收敛规则数过少');
    for (const entry of entries) {
      assert.equal(entry[3], 'true', `${entry[1]} 必须是 permanent（308）`);
    }
  });

  test('opc-N 规则必须排在通配 /news/:slug+ 之前（redirects 按序匹配）', () => {
    assert.ok(
      config.indexOf('/news/opc-:id(') < config.indexOf("source: '/news/:slug+'"),
      '/news/opc-<id> 的精确规则必须先于通配规则',
    );
    // 通配必须用 :slug+（一段及以上），否则 /news 会 308 到自身形成环
    assert.ok(config.includes("source: '/news/:slug+'"), '通配规则必须用 :slug+');
    assert.ok(!config.includes("source: '/news/:slug*'"), '不得使用 :slug*（会形成重定向环）');
  });

  test('旧路由文件已删除，不随构建复活', () => {
    // ⚠️ /academy 与 /news 在新架构里是**正式公开路由**（参考站页面），
    // 它们不是「旧路由文件」—— 这里只锁真正下线的那批。
    for (const path of [
      'src/app/agents/page.tsx',
      'src/app/market/[slug]/page.tsx',
      'src/app/newslist/page.tsx',
      'src/app/activitylist/page.tsx',
      'src/app/center/page.tsx',
      'src/app/traffic/page.tsx',
      'src/app/work/page.tsx',
      'src/app/[...opcPath]/page.tsx',
    ]) {
      assert.equal(existsSync(resolve(repoRoot, path)), false, `${path} 应已删除`);
    }
    // 正式公开路由必须在（复刻页不是通配兜底）
    for (const path of ['src/app/academy/page.tsx', 'src/app/news/page.tsx', 'src/app/market/page.tsx']) {
      assert.equal(existsSync(resolve(repoRoot, path)), true, `${path} 应存在`);
    }
  });

  test('导航正主不在收敛表里：/empower、/apply、/growth、/academy 仍为正式路由', () => {
    for (const source of [
      "source: '/empower",
      "source: '/apply",
      "source: '/growth",
      "source: '/academy'",
      "source: '/empower/:slug",
    ]) {
      assert.ok(!config.includes(source), `${source} 不应出现在下线收敛表`);
    }
  });
});

describe('供需页 · 静态渲染红线', () => {
  test('市场入口走运行时装配（供需榜由 DB 接管）', () => {
    assert.match(marketSrc, /getRuntimeReplicaPage\('\/market'\)/);
    assert.match(marketSrc, /export const revalidate = 300/);
    assert.doesNotMatch(marketSrc, /await\s+searchParams/);
  });

  test('市场页没有独立搜索栏（参考站市场没有搜索控件）', () => {
    assert.equal(
      (marketHtml.match(/<input[^>]*type="search"/g) ?? []).length,
      0,
      '参考站市场没有独立搜索栏，复现不额外注入旧版控件',
    );
  });

  test('全站不允许手写搜索输入框（筛选统一走参考站的 #agentSearch）', () => {
    const INPUT_SEARCH = /<input\b[^>]*\btype\s*=\s*(?:"search"|'search'|\{\s*["']search["']\s*\})/i;
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(resolve(repoRoot, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(rel);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        if (INPUT_SEARCH.test(read(rel))) offenders.push(rel);
      }
    };
    walk('src');
    assert.deepEqual(offenders, [], '这些文件手写了搜索输入框（筛选应统一走参考站语义）');
  });

  test('供需榜已下线：产物里不再有供需榜的标记', () => {
    // 2026-11-10 用户要求移除「COMMUNITY BOARD · 社区供需榜」模块，
    // 供给/需求两列不再由 market_items 表接管展示。
    for (const marker of ['market-supply', 'market-demand', 'market-items', 'market-board']) {
      const hits = (marketHtml.match(new RegExp(`data-opc-block="${marker}"`, 'g')) ?? []).length;
      assert.equal(hits, 0, `${marker} 不应再出现（实际 ${hits}）`);
    }
    assert.ok(!marketHtml.includes('COMMUNITY BOARD'), '社区供需榜标题不得回归');
  });
});
