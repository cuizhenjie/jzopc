/**
 * 公开导航与外壳边界的契约测试。
 *
 * ── 2026-11-10 全站复刻后 ───────────────────────────────────────────────
 *   导航与参考站菜单逐项一致，共 9 项：
 *     首页 / 关于集智(4 个下拉锚点) / 大健康+AI / 八大赋能 / 供需发布 /
 *     流量赋能 / 集智商学院 / 社区动态 / 申请入驻(CTA)
 *
 * 删除的旧断言（逐条说明）：
 *   - 「导航主项 8 项、关于集智没有下拉」→ 参考站的「关于集智」带 4 个下拉锚点，
 *     主项因此变成 9 项；
 *   - 「八大赋能下拉 8 项 / 社区动态下拉 newslist+activitylist」
 *     → 参考站的菜单是**单层**（八大赋能与社区动态都不带下拉）；
 *   - 「导航/页脚指向 /center、/newslist 等旧路由」→ 旧路由已 308 下线；
 *   - 「/opclogin、/opcregister 等账号页吃独立外壳」→ 账号页已随旧站下线，
 *     现在只有 /admin 与 /ops 两块独立外壳。
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicChromeMode, publicNavigation, navigationMatchesPath } from '@/lib/site/navigation';
import { nav, empowerModules } from '@/lib/site/config';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** 递归收集目录下的文件（用于全库占位符扫描） */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');

/** 扫描 src/app/ 收集页面路由（[slug] 视为动态段）。 */
function collectPageRoutes(dir: string, prefix: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const seg = entry.name.startsWith('(') && entry.name.endsWith(')') ? '' : entry.name;
      collectPageRoutes(full, `${prefix}/${seg}`, out);
    } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
      out.push(prefix || '/');
    }
  }
  return out;
}

const pageRoutes = collectPageRoutes(resolve(repoRoot, 'src/app'), '');

function routeMatches(actual: string, target: string): boolean {
  const actualSegments = actual.split('/').filter(Boolean);
  const targetSegments = target.split('/').filter(Boolean);
  const match = (a: string[], t: string[]): boolean => {
    if (a.length === 0 || t.length === 0) return a.length === t.length;
    if (a[0].startsWith('[') && a[0].endsWith(']')) return match(a.slice(1), t.slice(1));
    return a[0] === t[0] && match(a.slice(1), t.slice(1));
  };
  return match(actualSegments, targetSegments);
}

describe('公开导航契约（与参考站菜单逐项一致）', () => {
  test('config 复用同一份轻量导航，不维护第二套链接', () => {
    assert.equal(nav, publicNavigation);
  });

  test('导航共 9 项，其中 1 项是 CTA', () => {
    assert.equal(publicNavigation.length, 9);
    assert.equal(publicNavigation.filter((item) => item.cta).length, 1);
    assert.equal(publicNavigation.find((item) => item.cta)?.href, '/apply');
  });

  test('9 项的顺序与参考站菜单一致', () => {
    assert.deepEqual(publicNavigation.map((item) => item.label), [
      '首页', '关于集智', '大健康+AI', '八大赋能', '供需发布', '流量赋能', '集智商学院', '社区动态', '申请入驻',
    ]);
    assert.deepEqual(publicNavigation.map((item) => item.href), [
      '/', '/about', '/health', '/empower', '/market', '/growth', '/academy', '/news', '/apply',
    ]);
  });

  test('关于集智的 4 个子项都是 /about 的锚点', () => {
    const about = publicNavigation.find((item) => item.href === '/about');
    assert.ok(about, '导航里必须有「关于集智」');
    assert.deepEqual(about!.children?.map((child) => child.label), ['集智简介', '发展历程', '服务对象', '生态伙伴']);
    assert.deepEqual(about!.children?.map((child) => child.href), [
      '/about#intro', '/about#history', '/about#who', '/about#eco',
    ]);
    for (const child of about!.children ?? []) {
      assert.ok(child.href.startsWith('/about#'), child.href);
      assert.ok(child.href.split('#')[1].length > 0, child.href);
    }
  });

  test('除「关于集智」外，其余主项都没有下拉（参考站是单层菜单）', () => {
    for (const item of publicNavigation) {
      if (item.href === '/about') continue;
      assert.equal(item.children, undefined, `${item.label} 不应有下拉`);
    }
  });

  test('每一项 href 都能在 src/app/ 找到对应路由', () => {
    for (const item of publicNavigation) {
      const matched = pageRoutes.some((route) => routeMatches(route, item.href));
      assert.ok(matched, `导航「${item.label}」的 href ${item.href} 在 src/app/ 下没有对应路由`);
    }
    for (const item of publicNavigation) {
      for (const child of item.children ?? []) {
        // 锚点只影响页内定位，路由存在性按路径部分判定
        const path = child.href.split('#')[0];
        const matched = pageRoutes.some((route) => routeMatches(route, path));
        assert.ok(matched, `导航「${item.label} > ${child.label}」的 ${child.href} 没有对应路由`);
      }
    }
  });

  test('导航不再指向已下线的旧路由', () => {
    const hrefs = publicNavigation.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)]);
    for (const retired of ['/newslist', '/activitylist', '/center', '/traffic', '/work', '/zone', '/starproject', '/community']) {
      assert.ok(!hrefs.includes(retired), retired);
    }
  });

  test('八大赋能主项指向总览页，详情页是原生路由', () => {
    assert.equal(publicNavigation.find((item) => item.label === '八大赋能')?.href, '/empower');
    assert.ok(pageRoutes.includes('/empower/[slug]'), '八大赋能详情页应由动态路由提供');
    for (const module of empowerModules) {
      assert.ok(pageRoutes.some((route) => routeMatches(route, module.href)), module.href);
    }
  });
});

describe('页脚链接可达', () => {
  const footerSource = read('src/components/layout/Footer.tsx');
  const footerHrefs = [...footerSource.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

  test('页脚至少有一组链接，且全部可在 src/app/ 找到路由', () => {
    assert.ok(footerHrefs.length >= 8, '页脚链接过少');
    for (const href of footerHrefs) {
      const path = href.split('#')[0];
      const matched = pageRoutes.some((route) => routeMatches(route, path));
      assert.ok(matched, `页脚链接 ${href} 在 src/app/ 下没有对应路由`);
    }
  });

  test('页脚锚点指向 /about 的真实锚点', () => {
    const about = JSON.parse(read('src/lib/opc/generated/pages.json'))['/about'].html as string;
    const anchors = new Set([...about.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
    for (const href of footerHrefs) {
      if (!href.includes('#')) continue;
      const [path, fragment] = href.split('#');
      assert.equal(path, '/about', href);
      assert.ok(anchors.has(fragment), `页脚锚点 ${href} 在 /about 页里不存在`);
    }
  });

  test('页脚链接只指向已声明的公开路由（无死链）', () => {
    const publicRoutes = new Set(['/', '/about', '/health', '/empower', '/market', '/growth', '/academy', '/news', '/apply']);
    for (const href of footerHrefs) {
      assert.ok(publicRoutes.has(href.split('#')[0]), `页脚链接 ${href} 不在公开路由里`);
    }
  });

  test('页脚使用参考站外壳类名（.ft / .ft__links / .ft__ct）', () => {
    assert.match(footerSource, /className="ft"/);
    assert.match(footerSource, /className="ft__links"/);
    assert.match(footerSource, /className="ft__ct"/);
  });
});

describe('导航高亮规则', () => {
  test('路径完全相等或落在子路径下时高亮', () => {
    assert.equal(navigationMatchesPath('/agent', '/agent'), true);
    assert.equal(navigationMatchesPath('/empower/space', '/empower'), true);
    assert.equal(navigationMatchesPath('/empower/space', '/empower/space'), true);
    assert.equal(navigationMatchesPath('/about', '/empower'), false);
  });

  test('锚点不参与匹配（高亮只看路径）', () => {
    assert.equal(navigationMatchesPath('/about', '/about#intro'), true);
    assert.equal(navigationMatchesPath('/about', '/about#history'), true);
  });

  test('旧路径不会被误判成新导航项（它们已被 308 收敛）', () => {
    assert.equal(navigationMatchesPath('/agents/writer', '/agent'), false);
    assert.equal(navigationMatchesPath('/newslist', '/news'), false);
    assert.equal(navigationMatchesPath('/center', '/academy'), false);
    assert.equal(navigationMatchesPath('/traffic', '/growth'), false);
  });
});

describe('公开外壳边界', () => {
  test('首页与内页走公开外壳，后台与运营区走独立外壳', () => {
    assert.equal(publicChromeMode('/'), 'home');
    assert.equal(publicChromeMode('/agent'), 'page');
    assert.equal(publicChromeMode('/empower/agents'), 'page');
    assert.equal(publicChromeMode('/about'), 'page');
  });

  test('/admin 与 /ops 不吃公开外壳', () => {
    for (const path of ['/admin', '/admin/news', '/admin/login', '/ops/leads', '/ADMIN/login/', '/ops']) {
      assert.equal(publicChromeMode(path), 'independent', path);
    }
  });

  test('非 /admin|/ops 前缀的路径一律吃公开外壳', () => {
    for (const path of ['/about', '/apply', '/news', '/administrator', '/ops-example', '/newslist']) {
      assert.equal(publicChromeMode(path), 'page', path);
    }
  });

  test('SiteChrome：公开分支挂 .opc-site，独立分支挂 .opc-independent', () => {
    const source = read('src/components/layout/SiteChrome.tsx');
    assert.ok(source.includes('className="opc-site"'), '公开站外壳根节点必须是 .opc-site（参考站样式的作用域根）');
    assert.ok(source.includes('className="opc-independent"'), '后台/运营区必须是 .opc-independent');
    // 独立分支不得渲染 Header / Footer
    const start = source.indexOf('if (independent)');
    const end = source.indexOf('return (', start);
    const independentBranch = source.slice(start, end);
    assert.ok(independentBranch.length > 0, '找不到独立分支');
    assert.ok(!independentBranch.includes('<Header'), '独立分支不得渲染公开 Header');
    assert.ok(!independentBranch.includes('<Footer'), '独立分支不得渲染公开 Footer');
    // 公开分支必须渲染 Header / Footer
    const publicBranch = source.slice(end);
    assert.ok(publicBranch.includes('<Header'), '公开分支必须渲染 Header');
    assert.ok(publicBranch.includes('<Footer'), '公开分支必须渲染 Footer');
  });

  test('Header / Footer 使用参考站结构与参考站品牌图', () => {
    const header = read('src/components/layout/Header.tsx');
    const footer = read('src/components/layout/Footer.tsx');
    for (const source of [header, footer]) {
      assert.ok(source.includes('/opc/reference/img/logo-icon.png'), '品牌图必须用参考站素材');
      assert.ok(!source.includes('BrandMark'), '不再使用旧的 BrandMark 组件');
    }
    for (const cls of ['nav', 'menu', 'mlink', 'drop', 'burger', 'mnav']) {
      assert.ok(header.includes(cls), `Header 缺少参考站类名 ${cls}`);
    }
  });

  test('页脚「联系我们」不再有入驻咨询行', () => {
    // 用户 2026-11-21 要求删除页脚底部的「入驻咨询：提交入驻意向表」那一栏
    const footer = read('src/components/layout/Footer.tsx');
    assert.ok(!footer.includes('入驻咨询'), '页脚不得残留「入驻咨询」文案');
    assert.ok(!footer.includes('提交入驻意向表'), '页脚不得残留「提交入驻意向表」入口');
    // 保留另外两行联系方式
    assert.ok(footer.includes('首期'), '页脚应保留地址行');
    assert.ok(footer.includes('9:30'), '页脚应保留服务时间行');
  });

  test('页脚备案号取自站点配置，且不是占位符', () => {
    const footer = read('src/components/layout/Footer.tsx');
    const config = read('src/lib/site/config.ts');
    // 备案号必须来自 site.icp（单一事实源），不允许在组件里硬编码
    assert.ok(config.includes('京ICP备2023030613号'), 'site.icp 应为业务方提供的备案号');
    assert.ok(footer.includes('{site.icp}'), 'Footer 必须渲染 site.icp');
    assert.ok(!/京ICP备\s*X/i.test(footer), 'Footer 不得残留占位备案号');
    assert.ok(!/京ICP备\s*X/i.test(config), '配置里不得残留占位备案号');
  });

  test('全库（源码 + 参考站快照）不得残留占位备案号', () => {
    // 占位串在快照里也必须替换掉：将来重新抓取 / 复用快照时不会把占位符带回前台
    const roots = ['src', 'scripts/opc-reference', 'scripts/build-opc-content.py', 'docs'];
    const offenders: string[] = [];
    for (const root of roots) {
      const abs = resolve(repoRoot, root);
      const files = statSync(abs).isDirectory() ? walk(abs) : [abs];
      for (const file of files) {
        if (!/\.(ts|tsx|mjs|md|html|css|json)$/.test(file)) continue;
        const text = readFileSync(file, 'utf8');
        if (/京ICP备\s*X/i.test(text)) offenders.push(file.replace(repoRoot + '/', ''));
      }
    }
    assert.deepEqual(offenders, [], `以下文件仍残留占位备案号：\n  ${offenders.join('\n  ')}`);
  });
});
