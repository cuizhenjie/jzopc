/**
 * 参考站市场的完整供需、筛选与静态渲染验证。
 * 旧版原生页（/agents、/academy、/news/[slug]、/market/[slug]）已于 2026-10-26
 * 下线并 308 收敛到复刻页 —— 收敛表在 next.config.ts，这里锁死不回潮；
 * 同时保留搜索输入框唯一性守卫与 URL 工具的行为验证。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { facetMatches } from '@/components/opc/interaction-model';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');

const marketSrc = read('src/app/market/page.tsx');
const marketHtml = JSON.parse(read('src/lib/opc/generated/pages.json'))['/market'].html as string;
const replicaListings = JSON.parse(read('src/lib/opc/generated/listings.json'));

describe('旧版原生页下线 · 308 收敛表（2026-10-26）', () => {
  const config = read('next.config.ts');

  test('七条下线跳转全部在 next.config redirects() 里且为 308', () => {
    const rules: Array<[string, string]> = [
      ['/agents', '/agent'],
      ['/agents/:slug', '/agent'],
      ['/academy', '/center'],
      ['/academy/courses/:slug', '/center'],
      ['/market/:slug', '/market'],
      ['/news/opc-:id(', '/newsdetail?id=:id'],
      ['/news/:slug*', '/newslist'],
    ];
    for (const [source, destination] of rules) {
      assert.ok(config.includes(`source: '${source}`), `收敛表缺少 source ${source}`);
      assert.ok(config.includes(`destination: '${destination}'`), `收敛表缺少 destination ${destination}`);
    }
    // opc-N 规则必须排在通配 /news/* 之前（redirects 按序匹配）
    assert.ok(
      config.indexOf('/news/opc-:id(') < config.indexOf("source: '/news/:slug*'"),
      '/news/opc-<id> 的精确规则必须先于通配规则',
    );
  });

  test('旧路由文件已删除，不随构建复活', () => {
    for (const path of [
      'src/app/agents/page.tsx',
      'src/app/academy/page.tsx',
      'src/app/news/page.tsx',
      'src/app/market/[slug]/page.tsx',
    ]) {
      assert.equal(existsSync(resolve(repoRoot, path)), false, `${path} 应已删除`);
    }
  });

  test('导航正主不在收敛表里：/empower、/apply、/traffic 仍为原生页', () => {
    for (const source of [
      "source: '/empower",
      "source: '/apply",
      "source: '/traffic",
      "source: '/empower/:slug",
    ]) {
      assert.ok(!config.includes(source), `${source} 不应出现在下线收敛表`);
    }
  });
});

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

describe('搜索控件唯一性与静态渲染红线', () => {  test('市场页没有独立搜索栏', () => {
    assert.equal(
      (marketHtml.match(/<input[^>]*type="search"/g) ?? []).length,
      0,
      '参考站市场没有独立搜索栏，复现不额外注入旧版控件',
    );
  });

  test('全站不允许手写搜索输入框（旧 SearchField 原语已随 /agents 页下线删除）', () => {
    // 旧守卫是「必须用 SearchField」；2026-10-26 第二批清理删除了 SearchField
    // （最后一个消费者 /agents 页已 308 收敛）。新守卫更严：站内不允许任何
    // type="search" 输入框，复刻页筛选全部走 ReplicaInteractions 的 action 模型。
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
    assert.deepEqual(offenders, [], '这些文件手写了搜索输入框（站内已无搜索 UI，不应出现）');
  });

  test('市场页不得 await searchParams（否则 <title> 会落到 </body> 之后）', () => {
    assert.doesNotMatch(marketSrc, /await\s+searchParams/, '供需页必须保持静态渲染');
  });
});
