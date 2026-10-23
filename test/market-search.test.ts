/**
 * 参考站市场的完整供需、筛选与静态渲染验证。
 * 其余测试继续覆盖保留的智能体/全局搜索组件与URL工具；
 * 新市场使用公开快照数据，不再继承旧种子列表的SearchField结构契约。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFilterUrl } from '@/lib/filter/url';
import { facetMatches } from '@/components/opc/interaction-model';
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
const marketHtml = JSON.parse(read('src/lib/opc/generated/pages.json'))['/market'].html as string;
const replicaListings = JSON.parse(read('src/lib/opc/generated/listings.json'));
const agentsSrc = read('src/app/agents/page.tsx');

describe('参考站市场 · 全量供需与筛选', () => {
  test('市场入口使用隔离的复现页面，保持服务端静态内容', () => {
    assert.match(marketSrc, /<ReplicaPage pathname="\/market"/);
    assert.doesNotMatch(marketSrc, /await\s+searchParams/);
  });

  test('22条公开供需全部带稳定id和类型，分类不是只改按钮颜色', () => {
    const ids = replicaListings.categories['14'].ids as number[];
    assert.equal(ids.length, 22);
    for (const id of ids) assert.ok(marketHtml.includes(`data-opc-id="${id}"`), `缺少供需 ${id}`);
    assert.match(marketHtml, /data-opc-action="filter-market" data-opc-value="supply"/);
    assert.match(marketHtml, /data-opc-action="filter-market" data-opc-value="demand"/);
    const interaction = read('src/components/opc/ReplicaInteractions.tsx');
    assert.match(interaction, /section\.hidden = demand/);
    assert.match(interaction, /section\.hidden = !demand/);
  });

  test('市场检索规则覆盖新数据，支持组合筛选及空结果', () => {
    for (const id of replicaListings.categories['14'].ids as number[]) {
      const item = replicaListings.records[String(id)];
      assert.ok(facetMatches(item.title, ['供给'], '供给', item.title.trim()));
      assert.equal(facetMatches(item.title, ['供给'], '需求', item.title.trim()), false);
      assert.equal(facetMatches(item.title, ['供给'], '全部', '完全不存在的市场关键词xyz'), false);
    }
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
      (marketHtml.match(/<input[^>]*type="search"/g) ?? []).length,
      0,
      '参考站市场没有独立搜索栏，复现不额外注入旧版控件',
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

  test('两处搜索的检索语料来自共享的 searchItemText（同一词同结果）', () => {
    // 只统一 UI 不够：可检索文本也必须同源，否则同一个词在两处列表搜出
    // 不同的结果 —— 同一个功能、两种行为。
    // （全局搜索页 /search 已于 2026-10-23 下线，现存搜索控件为列表页内筛选。）
    //
    // 这里只做**结构**断言，真正的「同源」由下面那条**语义**断言兜住：
    // 结构断言单独用会漏掉「表达式里额外改了语料」这种改法。
    const cases: Array<[string, string, RegExp]> = [
      ['智能体页', agentsSrc, /^searchItemText\(\s*agentToSearchItem\(/],
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
