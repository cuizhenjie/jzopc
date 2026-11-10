/**
 * 流量赋能页（/growth）契约。
 *
 * ── 2026-11-10 全站复刻后的变化 ─────────────────────────────────────────
 *   /traffic 已下线（308 → /growth）。流量赋能现在是**参考站快照页**
 *   （scripts/opc-reference/pages/growth.html → generated/pages.json['/growth']），
 *   页面内容（基地介绍 / 业务生态 / 标杆战报 / 合作邀请）全部来自参考站原件。
 *
 * 删除的旧断言（逐条说明）：
 *   - 「/traffic 页面不再 redirect 到独立站、不再引用 th.jimei.cn」
 *     → /traffic 页面文件已删除，改由 next.config 的 308 收敛到 /growth；
 *   - 「页面使用站内统一版式（PageHero + Section）、面包屑与内嵌表单已下线」
 *     → 页面现在是参考站快照，版式由参考站 CSS 提供；
 *   - 「traffic-base.ts 的七大板块 / 优势四项 / 人才阶梯 / 基地网络 / 案例战报」
 *     → 这些数据是旧站独立页的数据源，参考站的对应内容改由 growth.html 提供；
 *     数据文件 src/lib/data/traffic-base.ts 已不再被任何页面引用（死数据）。
 *
 * 现在锁死的是：
 *   1. /growth 路由存在，且内容确实来自参考站 growth 快照；
 *   2. 旧 /traffic 在 next.config.ts 里 308 到 /growth；
 *   3. 参考站 growth 页的关键战报数据（八马茶业 / 康师傅 / 立白 / 卫龙 …）
 *      在烘焙产物里逐字保留。
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');

const pages = JSON.parse(read('src/lib/opc/generated/pages.json')) as Record<string, { title: string; html: string }>;
const growth = pages['/growth'].html;
const referenceGrowth = read('scripts/opc-reference/pages/growth.html');

describe('/growth · 路由与来源', () => {
  test('/growth 路由存在，页面用参考站快照渲染', () => {
    assert.ok(existsSync(resolve(repoRoot, 'src/app/growth/page.tsx')), '缺少 /growth 页面');
    const source = read('src/app/growth/page.tsx');
    assert.match(source, /getReplicaPage\('\/growth'\)|pathname="\/growth"/, '/growth 应渲染参考站快照');
    // 标题由编译期从参考站 <title> 提取，逐字一致（参考站口径带中缀「集智 AIGC 新媒体流量基地」）
    assert.equal(
      pages['/growth'].title,
      '流量赋能 · 集智 AIGC 新媒体流量基地 · 集智 AI OPC 社区',
    );
  });

  test('growth 页内容确实来自参考站 growth.html（关键段落一致）', () => {
    assert.ok(growth.length > 5000, 'growth 页内容过短');
    // 参考站原件里的关键文案必须出现在烘焙产物里
    for (const fragment of ['不讲方法论，先看战报', '三种身份，三种进来', '标杆案例']) {
      assert.ok(referenceGrowth.includes(fragment), `参考站原件缺少「${fragment}」`);
      assert.ok(growth.includes(fragment), `烘焙产物缺少「${fragment}」`);
    }
    // 参考站 growth 页的锚点全部保留
    assert.deepEqual(
      [...growth.matchAll(/<section\b[^>]*id="([^"]+)"/g)].map((match) => match[1]),
      ['base', 'adv', 'biz', 'path', 'cases', 'join'],
    );
  });
});

describe('/traffic → /growth 的 308 收敛', () => {
  test('next.config.ts 里 /traffic 永久重定向到 /growth', () => {
    const config = read('next.config.ts');
    assert.ok(config.includes("source: '/traffic'"), '收敛表缺少 /traffic');
    assert.ok(config.includes("destination: '/growth'"), '收敛表缺少目标 /growth');
    const entry = config.match(/\{ source: '\/traffic', destination: '\/growth', permanent: (\w+) \}/);
    assert.ok(entry, '/traffic 的 308 规则形状不符');
    assert.equal(entry![1], 'true', '/traffic 必须 permanent（308）');
  });

  test('旧 /traffic 页面文件已删除', () => {
    assert.equal(existsSync(resolve(repoRoot, 'src/app/traffic/page.tsx')), false);
    assert.equal(existsSync(resolve(repoRoot, 'src/app/traffic')), false);
  });

  test('导航指向 /growth（不再是 /traffic）', () => {
    const navigation = read('src/lib/site/navigation.ts');
    assert.ok(navigation.includes("href: '/growth'"), '导航应指向 /growth');
    assert.ok(!navigation.includes("href: '/traffic'"), '导航不得再指向 /traffic');
  });
});

describe('参考站 growth 页 · 战报数据逐字保留', () => {
  test('战报表格存在且包含表头 + 5 行案例', () => {
    const table = growth.match(/<table class="gw-tb">([\s\S]*?)<\/table>/)?.[1];
    assert.ok(table, '缺少战报表格');
    // 1 行表头 + 5 行案例（四家品牌 + 大健康垂类 IP）
    assert.equal((table!.match(/<tr[^>]*>/g) ?? []).length, 6, '表头 + 5 行案例');
  });

  test('五家战报品牌与关键数字完整保留', () => {
    const cases: Array<[string, string[]]> = [
      ['八马茶业', ['中秋超品日', '2400 万+', '5 亿+', '茶类目 TOP1']],
      ['康师傅', ['双播专场', '200 万+', '1900%']],
      ['立白', ['品牌自播', '100 万+', '630 万+']],
      ['卫龙', ['品牌矩阵直播间', 'GMV 破百万']],
      ['大健康垂类 IP', ['公私域全域变现', '300 万+', '20–30 万']],
    ];
    for (const [brand, facts] of cases) {
      assert.ok(growth.includes(brand), `缺少战报品牌：${brand}`);
      for (const fact of facts) {
        assert.ok(growth.includes(fact), `${brand} 缺少关键数字：${fact}`);
      }
    }
  });

  test('战报数据在参考站原件与烘焙产物里逐字一致', () => {
    const table = growth.match(/<table class="gw-tb">([\s\S]*?)<\/table>/)?.[1] ?? '';
    const referenceTable = referenceGrowth.match(/<table class="gw-tb">([\s\S]*?)<\/table>/)?.[1] ?? '';
    assert.ok(referenceTable.length > 100, '参考站原件里没有战报表格');
    const cells = (html: string) =>
      [...html.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((match) => match[1].replace(/<[^>]+>/g, '').trim());
    assert.deepEqual(cells(table), cells(referenceTable));
  });

  test('数据口径注记保留（不夸大战报）', () => {
    assert.ok(growth.includes('数据取自项目战报，统计口径与时间以结案报告为准'));
  });

  test('流量赋能页的图片全部来自参考站素材目录', () => {
    const images = [...growth.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(images.length > 0, 'growth 页应至少有一张图');
    for (const src of images) {
      assert.ok(src.startsWith('/opc/reference/img/'), src);
      assert.ok(existsSync(resolve(repoRoot, `public${src}`)), src);
    }
  });
});

describe('旧流量基线数据已下线', () => {
  test('traffic-base.ts 不再被任何页面引用（死数据）', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(resolve(repoRoot, dir), { withFileTypes: true })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(rel);
          continue;
        }
        if (!/\.tsx?$/.test(entry.name)) continue;
        if (read(rel).includes('traffic-base')) offenders.push(rel);
      }
    };
    walk('src');
    assert.deepEqual(offenders, [], `这些文件仍在引用旧流量基线数据：${offenders.join(', ')}`);
  });
});
