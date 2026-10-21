/**
 * 供需页关键词搜索（FR-MARKET-07）与「全站同一个搜索原语」的契约校验。
 *
 * 过滤发生在**客户端**（`FilterRoot` 纯 DOM 操作，不触发 React 重渲染），
 * Node 里跑不出渲染结果，所以这里读源码做断言 —— 锁死两件最容易在
 * 后续迭代中被改坏的事：
 *
 *   1. **搜索框只能是共享原语**：`SearchField`。任何页面手写
 *      `<input type="search">` 都会让同一个功能长成三个样子；
 *   2. **列表页保持静态渲染**：不得 `await searchParams`（否则 `<title>`
 *      与 `<meta description>` 会被 flush 到 `</body>` 之后，SEO 与
 *      Lighthouse 都读不到）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFilterUrl } from '@/lib/filter/url';
import { searchItemText } from '@/lib/search/matcher';
import { agentToSearchItem, marketToSearchItem } from '@/lib/search/items';
import { buildSearchIndex } from '@/lib/search';
import { seedAgents, seedMarket, type Agent, type MarketItem } from '@/lib/data/seed';
import type { SearchItem } from '@/lib/search/matcher';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');


/**
 * 从源码里取出 `marker={...}` 的大括号内容（支持嵌套大括号）。
 *
 * 直接用 `/\{([^}]*)\}/` 会在表达式里出现嵌套花括号时截断，
 * 于是「页面私自改了语料」这种改法反而逃过断言 —— 必须做括号配平。
 */
function extractBracedExpr(src: string, marker: string): string | null {
  const at = src.indexOf(marker);
  if (at < 0) return null;
  const start = src.indexOf('{', at + marker.length);
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start + 1, i).trim();
    }
  }
  return null;
}

const marketSrc = read('src/app/market/page.tsx');
const agentsSrc = read('src/app/agents/page.tsx');

describe('供需页 · 关键词搜索（FR-MARKET-07）', () => {
  test('使用共享搜索原语 SearchField，且按 q 参数驱动', () => {
    assert.match(
      marketSrc,
      /import SearchField from '@\/components\/ui\/SearchField'/,
      '供需页必须使用共享原语 SearchField',
    );
    assert.match(
      marketSrc,
      /<SearchField[\s\S]*?param="q"/,
      'SearchField 必须以 q 作为查询参数名（与 FilterRoot 的 queryParam 对齐）',
    );
    assert.match(marketSrc, /basePath="\/market"/, 'SearchField 必须指向 /market');
  });

  test('供需卡片仍带可检索文本，关键词才有匹配对象', () => {
    assert.match(
      marketSrc,
      /data-filter-text=/,
      '供需卡片必须保留 data-filter-text，否则关键词搜索永远 0 结果',
    );
    assert.match(
      marketSrc,
      /data-filter-key=\{m\.type\}/,
      '供需卡片必须保留 data-filter-key，否则分类筛选失效',
    );
  });

  test('结果条数由 data-filter-count 承载（切分类 + 搜词后依然正确）', () => {
    assert.match(marketSrc, /data-filter-count/, '列表区需要 data-filter-count 元素');
    assert.match(marketSrc, /data-filter-empty/, '需要保留空态占位元素');
  });
});

describe('智能体页 · 搜索框统一到共享原语', () => {
  test('不再手写 <input type="search">', () => {
    assert.doesNotMatch(
      agentsSrc,
      /<input[^>]*type=["']search["']/,
      '智能体页不得手写搜索输入框，应统一用 SearchField',
    );
    assert.match(
      agentsSrc,
      /import SearchField from '@\/components\/ui\/SearchField'/,
      '智能体页必须使用共享原语 SearchField',
    );
    assert.match(agentsSrc, /<SearchField[\s\S]*?param="q"/, 'SearchField 必须以 q 作为查询参数名');
    assert.match(agentsSrc, /basePath="\/agents"/, 'SearchField 必须指向 /agents');
  });

  test('删除表单式搜索遗留的 data-filter-sync-input', () => {
    assert.doesNotMatch(
      agentsSrc,
      /data-filter-sync-input/,
      '实时过滤后不再需要同步分类的隐藏输入框',
    );
  });

  test('原有的计数与空态保留不动', () => {
    assert.match(agentsSrc, /data-filter-count/, '智能体页的结果计数必须保留');
    assert.match(agentsSrc, /data-filter-empty/, '智能体页的空态必须保留');
  });
});

describe('搜索控件唯一性与静态渲染红线', () => {  test('每个列表页只有一个搜索控件', () => {
    assert.equal(
      (marketSrc.match(/<SearchField\b/g) ?? []).length,
      1,
      '供需页只能有一个搜索控件',
    );
    assert.equal(
      (agentsSrc.match(/<SearchField\b/g) ?? []).length,
      1,
      '智能体页只能有一个搜索控件',
    );
  });

  test('全站只允许 SearchField 一个搜索输入框（防止以后新页面手写）', () => {
    // 这是「统一 UI 风格」最关键的一条守卫：共享原语一旦被绕过，
    // 同一个功能就会在三处长成三个样子，而且很难被肉眼发现。
    //
    // 匹配要覆盖各种写法：type="search" / type='search' / type={"search"} / 大小写，
    // 属性可跨行（[^>]* 本身能跨行）。
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
        if (rel === 'src/components/ui/SearchField.tsx') continue;
        if (INPUT_SEARCH.test(read(rel))) offenders.push(rel);
      }
    };
    walk('src');
    assert.deepEqual(offenders, [], '这些文件手写了搜索输入框，应统一用 SearchField');
  });

  test('三处搜索的检索语料来自共享的 searchItemText（同一词同结果）', () => {
    // 只统一 UI 不够：可检索文本也必须同源，否则搜「需求」在 /market 是 0 条、
    // 在 /search 却搜得到 —— 同一个功能、两种行为。
    //
    // 这里只做**结构**断言，真正的「同源」由下面那条**语义**断言兜住：
    // 结构断言单独用会漏掉「表达式里额外改了语料」这种改法。
    const cases: Array<[string, string, RegExp]> = [
      ['供需页', marketSrc, /^searchItemText\(\s*marketToSearchItem\(/],
      ['智能体页', agentsSrc, /^searchItemText\(\s*agentToSearchItem\(/],
      // 全局搜索页的条目本身就是转换后的 SearchItem，直接算即可
      ['全局搜索页', read('src/app/search/page.tsx'), /^searchItemText\(\s*item\s*\)/],
    ];
    for (const [name, src, pattern] of cases) {
      const expr = extractBracedExpr(src, 'data-filter-text');
      assert.ok(expr, `${name}必须写 data-filter-text`);
      assert.match(
        expr,
        pattern,
        `${name}的 data-filter-text 必须由 searchItemText(...) 生成，实际是：${expr}`,
      );
    }
  });

  test('列表页算出的语料与全局索引逐字相同（语义断言，不是恒真）', async () => {
    // 这一条是**求值**页面上真实的表达式，再与全局索引的值比对：
    // 只要有人在页面上私自改语料（哪怕仍然调用了共享转换器），
    // 算出来的字符串就会与索引不一致 → 测试失败。
    const index = await buildSearchIndex();
    const byHref = new Map(index.map((i) => [i.href, i]));

    const cases: Array<{
      name: string;
      src: string;
      items: Array<{ slug: string }>;
      toItem: (item: unknown) => SearchItem;
      seedItems: unknown[];
    }> = [
      {
        name: '供需页',
        src: marketSrc,
        items: seedMarket,
        toItem: (item) => marketToSearchItem(item as MarketItem),
        seedItems: seedMarket,
      },
      {
        name: '智能体页',
        src: agentsSrc,
        items: seedAgents,
        toItem: (item) => agentToSearchItem(item as Agent),
        seedItems: seedAgents,
      },
    ];

    for (const { name, src, toItem, seedItems } of cases) {
      const expr = extractBracedExpr(src, 'data-filter-text');
      assert.ok(expr, `${name}必须写 data-filter-text`);
      // 页面里的循环变量名各不相同（供需页用 m、智能体页用 a），
      // 所以把常见名字都绑上，避免断言因为变量名而失效。
      const evaluate = new Function(
        'm',
        'a',
        'item',
        'searchItemText',
        'marketToSearchItem',
        'agentToSearchItem',
        `return ${expr};`,
      );

      for (const item of seedItems) {
        const fromPage = evaluate(
          item,
          item,
          item,
          searchItemText,
          marketToSearchItem,
          agentToSearchItem,
        );
        const fromIndex = byHref.get(toItem(item).href);
        assert.ok(fromIndex, `索引里缺少条目 ${toItem(item).href}`);
        assert.equal(
          fromPage,
          searchItemText(fromIndex),
          `${name}：条目 ${toItem(item).href} 的语料在页面与全局索引之间不一致`,
        );
      }
    }
  });

  test('列表页不得 await searchParams（否则 <title> 会落到 </body> 之后）', () => {
    assert.doesNotMatch(marketSrc, /await\s+searchParams/, '供需页必须保持静态渲染');
    assert.doesNotMatch(agentsSrc, /await\s+searchParams/, '智能体页必须保持静态渲染');
  });
});

describe('筛选 URL 构造 · 切分类不丢搜索词', () => {
  const base = 'https://example.com';

  test('切分类时保留当前地址栏里的搜索词 q', () => {
    const url = buildFilterUrl({
      href: '/market?tab=supply',
      param: 'tab',
      value: 'supply',
      currentSearch: '?q=选品',
      base,
    });
    const u = new URL(url);
    assert.equal(u.pathname, '/market');
    assert.equal(u.searchParams.get('tab'), 'supply');
    assert.equal(u.searchParams.get('q'), '选品', '搜索词必须在切分类后仍然存在');
  });

  test('选「全部」（value 为空串）时删除该分类参数，但保留 q', () => {
    const url = buildFilterUrl({
      href: '/search',
      param: 'type',
      value: '',
      currentSearch: '?q=智能体&type=agent',
      base,
    });
    const u = new URL(url);
    assert.equal(u.searchParams.get('type'), null, 'type 应被删除');
    assert.equal(u.searchParams.get('q'), '智能体');
  });

  test('href 自带的参数优先于地址栏里的旧值', () => {
    const url = buildFilterUrl({
      href: '/agents?category=office',
      param: 'category',
      value: 'office',
      currentSearch: '?category=writing&q=x',
      base,
    });
    const u = new URL(url);
    assert.equal(u.searchParams.get('category'), 'office');
    assert.equal(u.searchParams.get('q'), 'x');
  });

  test('地址栏里没有其它参数时，URL 就是 href + 目标参数', () => {
    const url = buildFilterUrl({
      href: '/agents?category=design',
      param: 'category',
      value: 'design',
      currentSearch: '',
      base,
    });
    assert.equal(new URL(url).search, '?category=design');
  });

  test('切分类会连带保留无关的跟踪参数（UTM）', () => {
    // 记录当前行为：utm_* 会被一并带走，落地页归因不丢。
    const url = buildFilterUrl({
      href: '/market?tab=demand',
      param: 'tab',
      value: 'demand',
      currentSearch: '?utm_source=wechat',
      base,
    });
    assert.equal(new URL(url).searchParams.get('utm_source'), 'wechat');
  });
});
