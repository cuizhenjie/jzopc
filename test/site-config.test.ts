/**
 * `src/lib/site/config.ts` 的结构性约束校验。
 *
 * 三条硬约束：
 * 1. 八大赋能的 slug 唯一，且与 `src/lib/data/empower.ts` 的 `empowerDetails` 集合完全一致；
 * 2. 每个赋能都有非空的 title / tagline / href；
 * 3. 导航与页脚里的 href 指向的路由确实存在于 `src/app/`。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nav, footerNav, empowerModules, agentCategories, stats } from '@/lib/site/config';
import { empowerDetails } from '@/lib/data/empower';
import { seedAgents } from '@/lib/data/seed';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const appDir = resolve(repoRoot, 'src/app');

type Route = { path: string; kind: 'page' | 'api' };

/** 扫描 `src/app/`，收集页面路由与 API 路由；`[slug]` 视为动态段，路由组 `(x)` 不产生路径 */
function collectRoutes(dir: string, prefix: string, out: Route[]): Route[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const seg = entry.name.startsWith('(') && entry.name.endsWith(')') ? '' : entry.name;
      collectRoutes(full, `${prefix}/${seg}`, out);
    } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
      out.push({ path: prefix || '/', kind: 'page' });
    } else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
      out.push({ path: prefix || '/', kind: 'api' });
    }
  }
  return out;
}

/** 动态段匹配：实际路由里的 `[slug]` / `[...all]` 能匹配任意具体段 */
function matchSegments(actual: string[], target: string[]): boolean {
  if (actual.length === 0 || target.length === 0) {
    return actual.length === target.length;
  }
  const [head, ...rest] = actual;
  const [tHead, ...tRest] = target;

  if (head.startsWith('[[...') && head.endsWith(']]')) {
    return true; // optional catch-all：可匹配任意段数
  }
  if (head.startsWith('[...') && head.endsWith(']')) {
    if (rest.length === 0) return false; // catch-all 至少吃 1 段
    return tRest.length === 0 || matchSegments(rest, tRest);
  }
  if (head.startsWith('[') && head.endsWith(']')) {
    return matchSegments(rest, tRest);
  }
  return head === tHead && matchSegments(rest, tRest);
}

function routeMatches(actual: string, target: string): boolean {
  return matchSegments(
    actual.split('/').filter(Boolean),
    target.split('/').filter(Boolean),
  );
}

const routes = collectRoutes(appDir, '', []);
const pageRoutes = routes.filter((r) => r.kind === 'page').map((r) => r.path);
const apiRoutes = routes.filter((r) => r.kind === 'api').map((r) => r.path);

describe('路由清单扫描', () => {
  test('src/app/ 下能扫到路由', () => {
    assert.ok(pageRoutes.length > 0, '应至少扫到首页路由');
    assert.ok(pageRoutes.includes('/'), `应包含首页路由，实际：${pageRoutes.join(', ')}`);
  });

  test('八大赋能的子页面由动态路由提供', () => {
    assert.ok(
      pageRoutes.includes('/empower/[slug]'),
      `应存在 /empower/[slug]，实际：${pageRoutes.join(', ')}`,
    );
  });
});

describe('八大赋能 · slug 约束', () => {
  test('恰好 8 条赋能', () => {
    assert.equal(empowerModules.length, 8);
    assert.equal(empowerDetails.length, 8);
  });

  test('config.ts 里的 slug 唯一', () => {
    const slugs = empowerModules.map((m) => m.slug);
    assert.equal(new Set(slugs).size, slugs.length, `slug 重复：${slugs.join(', ')}`);
  });

  test('empowerDetails 里的 slug 唯一', () => {
    const slugs = empowerDetails.map((d) => d.slug);
    assert.equal(new Set(slugs).size, slugs.length, `slug 重复：${slugs.join(', ')}`);
  });

  test('config.ts 与 empower.ts 的 slug 集合完全一致', () => {
    const moduleSlugs = empowerModules.map((m) => m.slug).sort();
    const detailSlugs = empowerDetails.map((d) => d.slug).sort();
    assert.deepEqual(moduleSlugs, detailSlugs);
  });

  test('编号 01–08 连续且不重复', () => {
    const indexes = empowerModules.map((m) => m.index);
    assert.deepEqual(indexes, ['01', '02', '03', '04', '05', '06', '07', '08']);
  });
});

describe('八大赋能 · 字段完整性', () => {
  for (const m of empowerModules) {
    test(`${m.slug} 的 title / tagline / href 非空`, () => {
      assert.equal(typeof m.title, 'string');
      assert.ok(m.title.trim().length > 0, `${m.slug} 缺 title`);
      assert.equal(typeof m.tagline, 'string');
      assert.ok(m.tagline.trim().length > 0, `${m.slug} 缺 tagline`);
      assert.equal(typeof m.href, 'string');
      assert.ok(m.href.trim().length > 0, `${m.slug} 缺 href`);
    });

    test(`${m.slug} 的 href 与 slug 对应（/empower/<slug>）`, () => {
      assert.equal(m.href, `/empower/${m.slug}`);
    });

    test(`${m.slug} 的详情页条目完整`, () => {
      const detail = empowerDetails.find((d) => d.slug === m.slug);
      assert.ok(detail, `empowerDetails 缺少 ${m.slug}`);
      assert.ok(detail!.heroDesc.trim().length > 0, `${m.slug} 缺 heroDesc`);
      assert.ok(detail!.values.length > 0, `${m.slug} 缺 values`);
      assert.ok(detail!.items.length > 0, `${m.slug} 缺 items`);
    });
  }

  test('empowerDetails 的 related 指向真实存在的赋能', () => {
    const known = new Set(empowerDetails.map((d) => d.slug));
    for (const detail of empowerDetails) {
      for (const related of detail.related) {
        assert.ok(known.has(related), `${detail.slug} 的 related 指向未知 slug：${related}`);
      }
    }
  });
});

describe('导航与页脚 · 路由存在性', () => {
  test('主导航每一项的 href 都能在 src/app/ 找到对应路由', () => {
    for (const item of nav) {
      const matched = pageRoutes.some((r) => routeMatches(r, item.href));
      assert.ok(matched, `导航「${item.label}」的 href ${item.href} 在 src/app/ 下没有对应路由`);
    }
  });

  test('主导航下拉子项的 href 都能在 src/app/ 找到对应路由', () => {
    for (const item of nav) {
      for (const child of item.children ?? []) {
        const matched = pageRoutes.some((r) => routeMatches(r, child.href));
        assert.ok(
          matched,
          `导航「${item.label} > ${child.label}」的 href ${child.href} 在 src/app/ 下没有对应路由`,
        );
      }
    }
  });

  test('页脚每一项链接的 href 都能在 src/app/ 找到对应路由', () => {
    for (const group of footerNav) {
      for (const link of group.links) {
        const matched = pageRoutes.some((r) => routeMatches(r, link.href));
        assert.ok(
          matched,
          `页脚「${group.title} > ${link.label}」的 href ${link.href} 在 src/app/ 下没有对应路由`,
        );
      }
    }
  });

  test('八大赋能的 8 个 href 都能命中 /empower/[slug]', () => {
    for (const m of empowerModules) {
      const matched = pageRoutes.some((r) => routeMatches(r, m.href));
      assert.ok(matched, `赋能 ${m.slug} 的 href ${m.href} 命中不到实际路由`);
    }
  });

  test('导航主项数量与开发计划承诺的 8 项一致', () => {
    assert.equal(nav.length, 8, `导航主项应为 8 项，实际 ${nav.length}`);
  });
});

describe('智能体分类 · 与种子数据一致', () => {
  test('分类 slug 唯一且名称非空', () => {
    const slugs = agentCategories.map((c) => c.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for (const c of agentCategories) {
      assert.ok(c.name.trim().length > 0, `${c.slug} 缺名称`);
    }
  });

  test('种子智能体的 category 都属于已声明分类', () => {
    const known = new Set<string>(agentCategories.map((c) => c.slug));
    for (const agent of seedAgents) {
      assert.ok(known.has(agent.category), `智能体 ${agent.slug} 的分类 ${agent.category} 未声明`);
    }
  });
});

describe('首页指标 · 基本结构', () => {
  test('指标 key 唯一且数值与文案非空', () => {
    const keys = stats.map((s) => s.key);
    assert.equal(new Set(keys).size, keys.length);
    for (const s of stats) {
      assert.equal(typeof s.value, 'number');
      assert.ok(s.label.trim().length > 0, `${s.key} 缺文案`);
    }
  });
});
