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

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');

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

describe('搜索控件唯一性与静态渲染红线', () => {
  test('每个列表页只有一个搜索控件', () => {
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
        if (/<input[^>]*type=["']search["']/.test(read(rel))) offenders.push(rel);
      }
    };
    walk('src/app');
    walk('src/components');
    assert.deepEqual(offenders, [], '这些文件手写了搜索输入框，应统一用 SearchField');
  });

  test('三处搜索的检索语料必须来自同一个函数（同一词同结果）', () => {
    // 只统一 UI 不够：可检索文本也必须同源，否则搜「需求」在 /market 是 0 条、
    // 在 /search 却搜得到 —— 同一个功能、两种行为。
    for (const [name, src] of [
      ['供需页', marketSrc],
      ['智能体页', agentsSrc],
      ['全局搜索页', read('src/app/search/page.tsx')],
    ] as const) {
      assert.match(
        src,
        /searchItemText\(/,
        `${name}必须用 searchItemText() 生成 data-filter-text`,
      );
    }
    assert.match(marketSrc, /marketToSearchItem\(/, '供需页必须用共享的条目转换器');
    assert.match(agentsSrc, /agentToSearchItem\(/, '智能体页必须用共享的条目转换器');
  });

  test('列表页不得 await searchParams（否则 <title> 会落到 </body> 之后）', () => {
    assert.doesNotMatch(marketSrc, /await\s+searchParams/, '供需页必须保持静态渲染');
    assert.doesNotMatch(agentsSrc, /await\s+searchParams/, '智能体页必须保持静态渲染');
  });
});
