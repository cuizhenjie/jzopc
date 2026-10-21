/**
 * 全局搜索（PRD FR-SITE-08）的契约校验。
 *
 * 覆盖四件容易悄悄坏掉的事：
 *
 * 1. **匹配规则**（`src/lib/search/matcher.ts`）—— 页面与接口共用同一套逻辑，
 *    两边结果一旦分叉，「页面上看到的」和「接口拿到的」就对不上。
 * 2. **静态渲染红线**（`src/app/search/page.tsx`）—— 页面一旦 `await searchParams`
 *    就变成动态渲染，Next.js 会把 `<title>` / `<meta name="description">`
 *    flush 到 `</body>` 之后，搜索引擎与 Lighthouse 都读不到。
 * 3. **接口与页面同源**（`src/app/api/search/route.ts`）—— 接口必须调用
 *    `matchItems`，不能自己另写一套过滤。
 * 4. **索引覆盖四类内容** —— 智能体 / 供需 / 课程 / 动态都要在索引里。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchItems, searchItemText, type SearchItem } from '@/lib/search/matcher';
import { buildSearchIndex } from '@/lib/search';
import { agentToSearchItem, marketToSearchItem } from '@/lib/search/items';
import { seedAgents, seedCourses, seedMarket, seedNews } from '@/lib/data/seed';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const pageSrc = readFileSync(resolve(repoRoot, 'src/app/search/page.tsx'), 'utf8');
const routeSrc = readFileSync(resolve(repoRoot, 'src/app/api/search/route.ts'), 'utf8');
const headerSrc = readFileSync(resolve(repoRoot, 'src/components/layout/Header.tsx'), 'utf8');
const matcherSrc = readFileSync(resolve(repoRoot, 'src/lib/search/matcher.ts'), 'utf8');

/* 强制走回落分支：清掉 Supabase 相关环境变量（getSupabaseAdmin 是调用时读取） */
for (const key of [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]) {
  delete process.env[key];
}

const items: SearchItem[] = [
  {
    type: 'agent',
    typeLabel: '智能体',
    title: '飞书',
    summary: '智能协作办公套件，多维表格与会议纪要一体',
    href: '/agents/feishu',
    category: '办公',
    keywords: '协作 文档 会议',
  },
  {
    type: 'market',
    typeLabel: '需求',
    title: '连锁零售 AI 运营助手',
    summary: '需要能自动完成选品数据分析的 AI 助手',
    href: '/market/demand-retail-ai-ops',
    category: 'AI 电商',
    keywords: '某全国性零售品牌 选品',
  },
  {
    type: 'course',
    typeLabel: '课程',
    title: 'AI 电商运营从 0 到 1',
    summary: '用 AI 完成选品分析、商品文案与客服话术闭环',
    href: '/academy/courses/ai-ecommerce-basics',
    category: 'AI电商',
    keywords: '集智商学院教研组 选品',
  },
  {
    type: 'news',
    typeLabel: '动态',
    title: '算力超市开放首批算力券申请通道',
    summary: 'GPU 按需租用通道上线，同时开放算力券补贴申请',
    href: '/news/compute-market-open',
    category: '资讯',
    keywords: '集智 AI OPC 社区',
  },
];

describe('matchItems · 匹配规则', () => {
  test('q 大小写不敏感：同一个词用不同大小写命中同一批', () => {
    const lower = matchItems(items, { q: 'ai' }).map((i) => i.href);
    const upper = matchItems(items, { q: 'AI' }).map((i) => i.href);
    const mixed = matchItems(items, { q: 'Ai' }).map((i) => i.href);
    assert.ok(lower.length > 0, 'fixture 里应当有可命中的条目');
    assert.deepEqual(upper, lower);
    assert.deepEqual(mixed, lower);
  });

  test('q 大小写不敏感：英文关键词大小写混写也能命中', () => {
    const fixture: SearchItem[] = [
      { type: 'agent', typeLabel: '智能体', title: 'Microsoft 365', summary: 'Copilot 深度嵌入的办公生产力套件', href: '/agents/microsoft-365' },
    ];
    assert.equal(matchItems(fixture, { q: 'microsoft' }).length, 1);
    assert.equal(matchItems(fixture, { q: 'MICROSOFT' }).length, 1);
    assert.equal(matchItems(fixture, { q: 'MiCrOsOfT' }).length, 1);
  });

  test('q 为空 → 不做文本过滤，返回全部', () => {
    assert.equal(matchItems(items, { q: '' }).length, items.length);
    assert.equal(matchItems(items, {}).length, items.length);
    assert.equal(matchItems(items, { q: '   ' }).length, items.length);
  });

  test('type 过滤生效：只返回该类型', () => {
    const agents = matchItems(items, { type: 'agent' });
    assert.equal(agents.length, 1);
    assert.ok(agents.every((i) => i.type === 'agent'));
    assert.equal(matchItems(items, { type: 'course' })[0].href, '/academy/courses/ai-ecommerce-basics');
  });

  test('空 q + 有 type → 仍按 type 过滤', () => {
    const market = matchItems(items, { q: '', type: 'market' });
    assert.equal(market.length, 1);
    assert.equal(market[0].type, 'market');
  });

  test("type 为 'all' 或空串 → 不过滤类型", () => {
    assert.equal(matchItems(items, { type: 'all' }).length, items.length);
    assert.equal(matchItems(items, { type: '' }).length, items.length);
  });

  test('匹配范围含 title / summary / category / keywords', () => {
    assert.equal(matchItems(items, { q: '飞书' })[0].href, '/agents/feishu');
    assert.equal(matchItems(items, { q: '选品数据分析' })[0].href, '/market/demand-retail-ai-ops');
    assert.equal(matchItems(items, { q: 'AI 电商' })[0].href, '/market/demand-retail-ai-ops');
    assert.equal(matchItems(items, { q: '集智商学院教研组' })[0].href, '/academy/courses/ai-ecommerce-basics');
  });

  test('无匹配时返回空数组（不是 null）', () => {
    assert.deepEqual(matchItems(items, { q: '不存在的关键词zzz' }), []);
  });

  test('searchItemText 把 title / summary / category / keywords 与类型入口词拼成同一串', () => {
    assert.equal(
      searchItemText(items[0]),
      '飞书 智能协作办公套件，多维表格与会议纪要一体 办公 协作 文档 会议 智能体',
    );
  });

  test('类型入口词可检索：搜「智能体」能命中智能体条目', () => {
    // 智能体条目的标题/摘要/标签里并没有「智能体」三个字，
    // 入口词必须单独进可检索文本，否则搜「智能体」一条都搜不到。
    const hit = matchItems(items, { q: '智能体' });
    assert.equal(hit.length, 1);
    assert.equal(hit[0].href, '/agents/feishu');
  });

  test('typeSearch 优先于 typeLabel 参与匹配', () => {
    const fixture: SearchItem[] = [
      { type: 'market', typeLabel: '需求', typeSearch: '供需 需求', title: 'A', summary: '', href: '/market/a' },
      { type: 'market', typeLabel: '供给', typeSearch: '供需 供给', title: 'B', summary: '', href: '/market/b' },
    ];
    // 「供需」两条都命中
    assert.equal(matchItems(fixture, { q: '供需' }).length, 2);
    // 「需求」只命中需求方，供给方不该被带出来
    assert.deepEqual(matchItems(fixture, { q: '需求' }).map((i) => i.href), ['/market/a']);
    assert.deepEqual(matchItems(fixture, { q: '供给' }).map((i) => i.href), ['/market/b']);
  });

  test('长描述参与匹配（智能体简介里的长尾词）', () => {
    const fixture: SearchItem[] = [
      { type: 'agent', typeLabel: '智能体', title: '某产品', summary: '简介', href: '/agents/x', detail: '内置知识库与日程管理' },
    ];
    assert.equal(matchItems(fixture, { q: '知识库' }).length, 1);
  });

  test('matcher 是纯函数：不改动传入的数组', () => {
    const snapshot = JSON.stringify(items);
    matchItems(items, { q: '飞书', type: 'agent' });
    assert.equal(JSON.stringify(items), snapshot);
  });
});

describe('/search 页面 · 静态渲染红线与共享原语', () => {
  test('源码里没有 searchParams（await 它就会变成动态渲染，title/description 会掉出 <head>）', () => {
    assert.ok(!/searchParams/.test(pageSrc), '页面不得引用 searchParams');
    assert.ok(!/await\s+searchParams/.test(pageSrc), '页面不得 await searchParams');
  });

  test('复用共享搜索原语：SearchField + FilterRoot + FilterLink', () => {
    assert.ok(pageSrc.includes('SearchField'), '缺少 SearchField');
    assert.ok(pageSrc.includes('FilterRoot'), '缺少 FilterRoot');
    assert.ok(pageSrc.includes('FilterLink'), '缺少 FilterLink');
  });

  test('筛选参数与结果条目带 FilterRoot 约定的 data-* 属性', () => {
    assert.ok(pageSrc.includes('param="type"'), '分类参数应为 type');
    assert.ok(pageSrc.includes('queryParam="q"'), '文本参数应为 q');
    assert.ok(pageSrc.includes('data-filter-key'), '结果条目缺少 data-filter-key');
    assert.ok(pageSrc.includes('data-filter-text'), '结果条目缺少 data-filter-text');
    assert.ok(pageSrc.includes('data-filter-count'), '缺少结果计数');
    assert.ok(pageSrc.includes('data-filter-empty'), '缺少空态');
  });

  test('是静态页：导出 metadata 与 revalidate', () => {
    assert.ok(pageSrc.includes('export const metadata'), '缺少 metadata');
    assert.ok(pageSrc.includes('export const revalidate'), '缺少 revalidate');
  });
});

describe('/api/search 接口 · 与页面同源', () => {
  test('路由源码调用了 matchItems', () => {
    assert.ok(routeSrc.includes('matchItems('), '接口必须调用 matchItems');
    assert.ok(routeSrc.includes("@/lib/search/matcher"), '接口必须从共享匹配模块引入 matchItems');
  });

  test('出错时返回 500 而不是假装空结果', () => {
    assert.ok(routeSrc.includes('status: 500'), '出错必须返回 500');
    assert.ok(/error:/.test(routeSrc), '错误响应必须带 error 字段');
  });
});

describe('搜索索引 · 覆盖四类内容', () => {
  test('type 集合包含 agent / market / course / news', async () => {
    const index = await buildSearchIndex();
    const types = new Set(index.map((i) => i.type));
    for (const type of ['agent', 'market', 'course', 'news']) {
      assert.ok(types.has(type as SearchItem['type']), `索引缺少类型 ${type}`);
    }
  });

  test('索引条数等于四类种子数据之和', async () => {
    const index = await buildSearchIndex();
    const expected =
      seedAgents.length + seedMarket.length + seedCourses.length + seedNews.length;
    assert.equal(index.length, expected);
    assert.equal(index.length, 46);
  });

  test('每条都有真实标题、摘要与站内路径', async () => {
    const index = await buildSearchIndex();
    for (const item of index) {
      assert.ok(item.title.length > 0, '标题不能为空');
      assert.ok(item.summary.length > 0, '摘要不能为空');
      assert.ok(item.href.startsWith('/'), `href 必须是站内绝对路径：${item.href}`);
      assert.ok(item.typeLabel.length > 0, '类型名不能为空');
    }
  });

  test('智能体分类用中文名（不是 slug）', async () => {
    const index = await buildSearchIndex();
    const agent = index.find((i) => i.type === 'agent');
    assert.ok(agent);
    assert.ok(agent.category && !/^[a-z-]+$/.test(agent.category), `分类应是中文名：${agent.category}`);
  });

  test('FR 写的四个检索范围词都能命中对应分组', async () => {
    const index = await buildSearchIndex();
    // PRD FR-SITE-08：搜索范围是「智能体、供需、课程、资讯」——
    // 这四个词是用户最可能敲的，每一个都必须真的搜得到东西。
    const agents = matchItems(index, { q: '智能体' }).filter((i) => i.type === 'agent');
    assert.equal(agents.length, seedAgents.length, '搜「智能体」应命中全部智能体');

    const market = matchItems(index, { q: '供需' }).filter((i) => i.type === 'market');
    assert.equal(market.length, seedMarket.length, '搜「供需」应命中全部供需条目');

    const courses = matchItems(index, { q: '课程' }).filter((i) => i.type === 'course');
    assert.equal(courses.length, seedCourses.length, '搜「课程」应命中全部课程');

    const news = matchItems(index, { q: '资讯' }).filter((i) => i.type === 'news');
    assert.equal(news.length, seedNews.length, '搜「资讯」应命中全部动态');
  });

  test('搜「需求」只命中需求方，不把供给方带出来', async () => {
    const index = await buildSearchIndex();
    const demand = matchItems(index, { q: '需求' }).filter((i) => i.type === 'market');
    const supplyCount = seedMarket.filter((m) => m.type === 'supply').length;
    assert.equal(
      demand.length,
      seedMarket.length - supplyCount,
      '需求方条目数应等于供需总数减去供给方',
    );
    assert.ok(
      demand.every((i) => i.typeLabel === '需求'),
      '不应混进供给方条目',
    );
  });

  test('列表页与全局索引的检索语料逐字相同（同一词三处同结果）', async () => {
    // 这是「统一」的实质：同一条内容，在 /market、/agents、/search 三个搜索框里
    // 必须被同一段文本匹配。此前三个页面各拼各的 data-filter-text，
    // 于是搜「需求」在 /market 是 0 条、在 /search 却能搜到。
    const index = await buildSearchIndex();
    const byHref = new Map(index.map((i) => [i.href, i]));

    for (const m of seedMarket) {
      const fromIndex = byHref.get(`/market/${m.slug}`);
      assert.ok(fromIndex, `索引里缺少供需条目 ${m.slug}`);
      assert.equal(
        searchItemText(marketToSearchItem(m)),
        searchItemText(fromIndex),
        `供需条目 ${m.slug} 的语料在页面与索引之间不一致`,
      );
    }

    for (const a of seedAgents) {
      const fromIndex = byHref.get(`/agents/${a.slug}`);
      assert.ok(fromIndex, `索引里缺少智能体条目 ${a.slug}`);
      assert.equal(
        searchItemText(agentToSearchItem(a)),
        searchItemText(fromIndex),
        `智能体条目 ${a.slug} 的语料在页面与索引之间不一致`,
      );
    }
  });
});

describe('Header · 全局搜索入口', () => {
  test('提供可分享的 /search 入口与无障碍标签', () => {
    assert.ok(headerSrc.includes('href="/search"'), 'Header 缺少 /search 入口');
    assert.ok(headerSrc.includes('aria-label="站内搜索"'), '搜索入口缺少 aria-label');
  });

  test('Header 里不放第二个搜索框（只放入口，全站唯一搜索框在 /search 页）', () => {
    assert.ok(!/<input/i.test(headerSrc), 'Header 不应包含输入框');
    assert.ok(!headerSrc.includes('SearchField'), 'Header 不应复用搜索框组件');
  });
});

describe('共享匹配逻辑的边界', () => {
  test('matcher.ts 不 import 任何 server-only 模块（客户端也要用）', () => {
    assert.ok(!matcherSrc.includes('@/lib/queries'), 'matcher 不得依赖数据访问层');
    assert.ok(!matcherSrc.includes('supabase'), 'matcher 不得依赖 Supabase');
    assert.ok(!matcherSrc.includes("from 'react'"), 'matcher 不得依赖 React（保持纯函数）');
  });
});
