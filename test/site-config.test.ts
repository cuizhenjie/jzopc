/**
 * `src/lib/site/config.ts` 的结构性约束校验。
 *
 * 硬约束：
 * 1. 八大赋能的 slug 唯一，且与 `src/lib/data/empower.ts` 的 `empowerDetails` 集合完全一致；
 * 2. 每个赋能都有非空的 title / tagline / href；
 * 3. 导航与页脚里的 href 指向的路由确实存在于 `src/app/`；
 * 4. 智能体分类 slug 唯一、名称非空，且是合法 slug。
 *
 * ── 2026-11-10 全站复刻后的口径变化 ─────────────────────────────────────
 *   - 导航主项由 8 项改为 **9 项**（与参考站菜单逐项一致）：
 *     首页 / 关于集智(4 个下拉锚点) / 大健康+AI / 八大赋能 / 供需发布 /
 *     流量赋能 / 集智商学院 / 社区动态 / 申请入驻(CTA)。
 *   - 八大赋能第 06 项标题由「供需市场」改为「**订单市场**」（与参考站一致）。
 *
 * 删除的旧断言（逐条说明）：
 *   - 「导航主项数量为 8」→ 参考站菜单是 9 项（见上）；
 *   - 「页脚 footerNav 的每一项链接可达」→ footerNav 已**不再被任何组件引用**
 *     （新的页脚是 src/components/layout/Footer.tsx，自带参考站式链接），
 *     它仍留在 config.ts 里带着已下线的 /center、/newslist —— 属于死配置。
 *     这里改成两条更强的断言：真实渲染的页脚链接必须全部可达；
 *     且 footerNav 不得被任何组件引用（避免两套链接漂移）。
 *   - 「关于页文案与 intros/advantages/visions 一致」→ /about 已换成参考站快照，
 *     那三份旧文案不再参与前台渲染（见下）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nav, footerNav, empowerModules, agentCategories } from '@/lib/site/config';
import { empowerDetails } from '@/lib/data/empower';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const appDir = resolve(repoRoot, 'src/app');
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');

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
    if (rest.length === 0) return target.length >= 1; // trailing catch-all consumes every remaining segment
    return tRest.length > 0 && matchSegments(rest, tRest);
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

  test('参考站的 10 个公开路由都有页面实现', () => {
    for (const path of ['/', '/about', '/health', '/empower', '/market', '/growth', '/academy', '/news', '/newsdetail', '/apply', '/agent']) {
      assert.ok(pageRoutes.includes(path), `缺少公开路由 ${path}`);
    }
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

  test('第 06 项是「订单市场」（与参考站一致）', () => {
    const market = empowerModules.find((m) => m.slug === 'market');
    assert.equal(market?.index, '06');
    assert.equal(market?.title, '订单市场');
    // 参考站的八大赋能页也这么写 —— 两边不能漂移
    const empowerPage = JSON.parse(read('src/lib/opc/generated/pages.json'))['/empower'].html as string;
    assert.ok(empowerPage.includes('订单市场'), '参考站快照里没有「订单市场」');
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
        const matched = pageRoutes.some((r) => routeMatches(r, child.href.split('#')[0]));
        assert.ok(
          matched,
          `导航「${item.label} > ${child.label}」的 href ${child.href} 在 src/app/ 下没有对应路由`,
        );
      }
    }
  });

  test('八大赋能的 8 个 href 都能命中 /empower/[slug]', () => {
    for (const m of empowerModules) {
      const matched = pageRoutes.some((r) => routeMatches(r, m.href));
      assert.ok(matched, `赋能 ${m.slug} 的 href ${m.href} 命中不到实际路由`);
      assert.ok(
        pageRoutes.some((r) => r === '/empower/[slug]' && routeMatches(r, m.href)),
        `赋能 ${m.slug} 的 href ${m.href} 命中不到 /empower/[slug]`,
      );
    }
  });

  test('导航主项数量与参考站菜单一致（9 项）', () => {
    // 参考站菜单逐项：首页 / 关于集智 / 大健康+AI / 八大赋能 / 供需发布 /
    //                流量赋能 / 集智商学院 / 社区动态 / 申请入驻(CTA)
    assert.equal(nav.length, 9, `导航主项应为 9 项，实际 ${nav.length}`);
  });

  test('页脚（真实渲染的 Footer.tsx）每一项链接都能在 src/app/ 找到对应路由', () => {
    const footerSource = read('src/components/layout/Footer.tsx');
    const hrefs = [...footerSource.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(hrefs.length > 0, '页脚应至少有一条链接');
    for (const href of hrefs) {
      const matched = pageRoutes.some((r) => routeMatches(r, href.split('#')[0]));
      assert.ok(matched, `页脚链接 ${href} 在 src/app/ 下没有对应路由`);
    }
  });

  test('footerNav 常量已不再被任何组件引用（页脚不维护第二套链接）', () => {
    // footerNav 仍留在 config.ts 里（历史配置，含已下线的 /center、/newslist），
    // 但新的页脚是 Footer.tsx 自带链接 —— 不允许再被引用，否则两套链接会漂移。
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(resolve(repoRoot, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(rel);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        if (rel.endsWith('src/lib/site/config.ts')) continue; // 定义处本身
        if (/footerNav/.test(read(rel))) offenders.push(rel);
      }
    };
    walk('src');
    assert.deepEqual(offenders, [], `这些文件仍在引用旧的 footerNav：${offenders.join(', ')}`);
    assert.ok(footerNav.length > 0, '常量本身仍在（死配置，待清理）');
  });
});

describe('智能体分类 · 与后台选项同源', () => {
  test('分类 slug 唯一且名称非空', () => {
    const slugs = agentCategories.map((c) => c.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for (const c of agentCategories) {
      assert.ok(c.name.trim().length > 0, `${c.slug} 缺名称`);
    }
  });

  test('slug 是合法 slug（可安全进 data-cat 与 URL）', () => {
    for (const c of agentCategories) {
      assert.match(c.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, c.slug);
    }
  });

  test('智能体分类与数据库 agent_categories 表逐字一致（slug 是事实源）', () => {
    // ⚠️ 后台分类是事实源：前台 chips 的 data-cat、卡片的 data-opc-categories
    // 与后台表单选项全靠 slug 串起来；slug 对不上，前台 chips 就会显示英文原文。
    // 这里的基准是**灌库脚本的分类映射**（scripts/seed-reference-content.mjs 的
    // CATEGORY_SLUGS），它与库里 agent_categories 表的实际值一一对应。
    const seedSrc = read('scripts/seed-reference-content.mjs');
    const mapped = [...seedSrc.matchAll(/^\s+'?([^'\s:]+)'?:\s*'([a-z0-9-]+)',$/gm)]
      .filter((m) => /[\u4e00-\u9fa5]/.test(m[1]))
      .map((m) => m[2]);
    assert.ok(mapped.length >= 18, `分类映射解析异常，只拿到 ${mapped.length} 条`);

    const slugs = agentCategories.map((c) => c.slug);
    assert.deepEqual(
      [...slugs].sort(),
      [...mapped].sort(),
      'site/config.ts 的 agentCategories 与灌库脚本的分类 slug 不一致',
    );
    assert.equal(new Set(slugs).size, slugs.length, '分类 slug 必须唯一');
    assert.equal(slugs.length, 18, '应为 18 个分类');
  });

  test('后台资源模块与前台 chips 共用同一份分类', () => {
    const adminResources = read('src/lib/admin/resources.ts');
    assert.ok(adminResources.includes('agentCategories'), '后台资源模块必须复用同一份分类');
    const blocks = read('src/lib/opc/blocks-runtime.ts');
    assert.ok(blocks.includes('agentCategories'), '前台 /agent 的 chips 必须复用同一份分类');
  });
});

describe('站点常量 · API 路由与文案', () => {
  test('线索接口仍在（前台表单提交的唯一出口）', () => {
    assert.ok(apiRoutes.includes('/api/leads'), '缺少 /api/leads');
    assert.ok(apiRoutes.includes('/api/admin/leads/[id]'), '缺少 /api/admin/leads/[id]');
    assert.ok(apiRoutes.includes('/api/admin/leads/export'), '缺少 /api/admin/leads/export');
  });

  test('旧的中文案常量不再参与前台渲染（/about 已换成参考站快照）', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(resolve(repoRoot, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(rel);
          continue;
        }
        if (!/\.tsx$/.test(entry.name)) continue;
        const source = read(rel);
        if (/\b(intros|advantages|visions)\b/.test(source)) offenders.push(rel);
      }
    };
    walk('src');
    assert.deepEqual(offenders, [], `这些组件仍在渲染旧文案常量：${offenders.join(', ')}`);
  });
});
