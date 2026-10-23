/**
 * OPC 快照 → news_posts 迁移脚本（scripts/migrate-opc-news.mjs）的单测。
 *
 * 只测**映射纯函数**（buildMigrationPlan / mapRecordToRow / rebrand /
 * epochSecondsToIso / localizeCover），全程不连库 —— 数据库写入路径
 * （幂等 upsert）由 --dry-run 与实写环境守卫保证，不属于单测范围。
 *
 * 契约：docs/14-动态内容契约.md §3；品牌替换规则移植自 build-opc-content.py。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BRAND_MARKERS,
  DEFAULT_CATEGORY_BY_CHANNEL,
  LEGACY_CHANNEL_BY_CATEGORY_ID,
  buildMigrationPlan,
  epochSecondsToIso,
  localizeCover,
  mapRecordToRow,
  rebrand,
} from '../scripts/migrate-opc-news.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const snapshot = JSON.parse(readFileSync(resolve(repoRoot, 'scripts/opc-source/public-content.json'), 'utf8'));
const assetMap: Record<string, string> = JSON.parse(readFileSync(resolve(repoRoot, 'scripts/opc-source/asset-map.json'), 'utf8'));

/** news_posts 迁移行的形状（与 supabase/migrations/0001_init.sql 的列一一对应） */
interface NewsPostRow {
  slug: string;
  title: string;
  summary: string;
  body: string[];
  cover_url: string;
  category: string;
  author: string;
  status: string;
  published_at: string | null;
}

interface MigrationPlan {
  rows: NewsPostRow[];
  stats: {
    total: number;
    byChannel: { news: number; activity: number };
    unmappedCovers: number;
    expectedByCategory: Record<string, number>;
  };
}

// 脚本是 .mjs（JS 推断不出行的字段），在消费侧收窄类型。
const plan = buildMigrationPlan(snapshot, assetMap) as unknown as MigrationPlan;

/** 快照里的一条真实 record（按 id 取，缺了说明源文件变了，测试就该挂） */
function recordById(id: number): Record<string, unknown> & { category_id: number } {
  const record = snapshot.records[String(id)];
  assert.ok(record, `snapshot 缺少 record ${id}`);
  return record;
}

/** 按 slug 取行；缺行直接让测试挂 */
function findRow(slug: string): NewsPostRow {
  const row = plan.rows.find((item) => item.slug === slug);
  assert.ok(row, `plan 缺少行 ${slug}`);
  return row;
}

describe('类目筛选与条数（88 新闻 + 22 活动）', () => {
  test('总条数 110；news=88（category 10→资讯）、activity=22（category 16→活动）', () => {
    assert.equal(plan.stats.total, 110);
    assert.equal(plan.stats.byChannel.news, 88);
    assert.equal(plan.stats.byChannel.activity, 22);
  });

  test('与快照 categories 元数据逐类目对齐', () => {
    assert.equal(plan.stats.expectedByCategory['10'], 88);
    assert.equal(plan.stats.expectedByCategory['16'], 22);
    assert.equal(plan.stats.byChannel.news, plan.stats.expectedByCategory['10']);
    assert.equal(plan.stats.byChannel.activity, plan.stats.expectedByCategory['16']);
  });

  test('行内类目只允许 资讯/活动 两个值', () => {
    const categories = new Set(plan.rows.map((row) => row.category));
    assert.deepEqual([...categories].sort(), ['活动', '资讯']);
  });

  test('非目标类目（14/15/17）的 record 不产出行', () => {
    const market = recordById(75); // categories["14"].ids[0]
    assert.equal(market.category_id, 14);
    assert.equal(mapRecordToRow(market, assetMap), null);
    assert.equal(mapRecordToRow({ id: 1, category_id: 15, title: 'x' }, assetMap), null);
    assert.equal(mapRecordToRow({ id: 2, category_id: 17, title: 'x' }, assetMap), null);
    assert.equal(mapRecordToRow(null, assetMap), null);
  });
});

describe('slug 规则（opc-<原id>）', () => {
  test('每行 slug 都是 opc-<数字> 且与源 record id 一一对应', () => {
    const seen = new Set<string>();
    for (const [id, record] of Object.entries(snapshot.records) as [string, { category_id: number }][]) {
      if (!(record.category_id in LEGACY_CHANNEL_BY_CATEGORY_ID)) continue;
      const expected = `opc-${id}`;
      assert.ok(plan.rows.some((row) => row.slug === expected), expected);
      seen.add(expected);
    }
    assert.equal(seen.size, 110);
    assert.equal(plan.rows.length, 110);
  });

  test('slug 形态匹配 /^opc-\\d+$/ 且无重复', () => {
    const slugs = plan.rows.map((row) => row.slug);
    for (const slug of slugs) assert.match(slug, /^opc-\d+$/);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  test('契约样例：id 392 → opc-392、id 197 → opc-197', () => {
    assert.ok(plan.rows.some((row) => row.slug === 'opc-392'));
    assert.ok(plan.rows.some((row) => row.slug === 'opc-197'));
  });
});

describe('品牌替换（rebrand：build-opc-content.py 规则移植）', () => {
  test('替换对语义：长短语优先、全量替换（非首次）、无关文本原样返回', () => {
    assert.equal(rebrand('同橙OPC社区平台'), '集智 AI OPC 社区');
    assert.equal(rebrand('同橙OPC社区'), '集智 AI OPC 社区');
    assert.equal(rebrand('同橙OPC'), '集智 AI OPC');
    // 全量替换：两处「同橙」都要换（JS String.replace 只换首处的坑）
    assert.equal(rebrand('同橙与同橙'), '集智AI与集智AI');
    // 城市子域名先于 ai.opcstore.com 消化，不产生残链
    assert.equal(rebrand('https://shanghai.opcstore.com/a'), 'https://www.jizhiai.net.cn/a');
    assert.equal(rebrand('ai.opcstore.com'), 'th.jimei.cn');
    assert.equal(rebrand('opc@tongcheng.ai'), 'opc@www.jizhiai.net.cn');
    assert.equal(rebrand('南京市鼓楼区古平岗4号智梦园B座'), '北京市丰台区西马场甲14号');
    // 短路条件：无标记文本原样返回（含空值）
    assert.equal(rebrand('普通标题，无品牌'), '普通标题，无品牌');
    assert.equal(rebrand(''), '');
    // 图片域名 www.opcstore.com 不在标记表里，保持原样（媒体地址不被替换）
    assert.equal(rebrand('https://www.opcstore.com/a.jpg'), 'https://www.opcstore.com/a.jpg');
  });

  test('全部 110 行的 title/summary/body 段落不残留任何品牌标记', () => {
    for (const row of plan.rows) {
      const texts = [row.title, row.summary, ...row.body];
      for (const text of texts) {
        for (const marker of BRAND_MARKERS) {
          assert.ok(!text.includes(marker), `${row.slug} 残留品牌标记「${marker}」`);
        }
      }
    }
  });

  test('契约 §2 兜底卡片样例：title 替换后与烘焙卡逐字一致', () => {
    const news = findRow('opc-392');
    assert.equal(news.title, '巾帼逐梦正当时，集智 AI OPC女性赋能计划第三期圆满收官！');
    assert.ok(news.summary.includes('集智 AI OPC 社区承办'));
    assert.ok(news.summary.includes('鼓楼集智 AI OPC 社区圆满举办'));
    assert.equal(findRow('opc-197').title, '集智AI学院首期“AI+OPC”社区运营官研修班圆满收官');
  });
});

describe('summary / body 提取', () => {
  test('summary 取 subtitle_list 中 sort==1 的 content（真实数据全覆盖）', () => {
    for (const row of plan.rows) {
      assert.ok(row.summary.length > 0, `${row.slug} summary 为空`);
    }
    const record = recordById(392) as unknown as { subtitle_list: { sort: number; content: string }[] };
    const expected = record.subtitle_list.find((item) => item.sort === 1)!.content;
    assert.equal(findRow('opc-392').summary, rebrand(expected));
  });

  test('body：过滤 sort==-1，按 sort 升序组成段落数组（合成记录验证排序）', () => {
    const synthetic = {
      id: 999991,
      category_id: 10,
      title: '排序用合成标题',
      create_time: 1792638177,
      head_image: [],
      subtitle_list: [{ sort: 1, content: '摘要' }],
      content: [
        { sort: 3, content: '第三段' },
        { sort: -1, content: '被排除的隐藏段' },
        { sort: 1, content: '第一段' },
        { sort: 2, content: '第二段' },
      ],
    };
    const row = mapRecordToRow(synthetic, assetMap) as NewsPostRow;
    assert.deepEqual(row.body, ['第一段', '第二段', '第三段']);
  });

  test('真实数据：body 是非空字符串数组（每条至少一段）', () => {
    for (const row of plan.rows) {
      assert.ok(Array.isArray(row.body) && row.body.length > 0, `${row.slug} body 为空`);
      for (const paragraph of row.body) assert.equal(typeof paragraph, 'string');
    }
  });
});

describe('cover 本地化（asset-map.json 查表）', () => {
  test('真实数据：110 条全部命中映射为 /opc/assets/ 本地路径', () => {
    assert.equal(plan.stats.unmappedCovers, 0);
    for (const row of plan.rows) {
      assert.match(row.cover_url, /^\/opc\/assets\//, `${row.slug} cover=${row.cover_url}`);
    }
  });

  test('契约样例：opc-392 → ebe827906d3808f9.webp、opc-197 → 9fa09649d9e7fea6.webp', () => {
    assert.equal(findRow('opc-392').cover_url, '/opc/assets/ebe827906d3808f9.webp');
    assert.equal(findRow('opc-197').cover_url, '/opc/assets/9fa09649d9e7fea6.webp');
  });

  test('无映射 / 无 head_image → 留空字符串，不编造路径', () => {
    const record = recordById(392) as unknown as { head_image: { url: string }[] };
    assert.equal(localizeCover(record.head_image, {}), '');
    assert.equal(localizeCover([], assetMap), '');
    assert.equal(localizeCover(undefined, assetMap), '');
    assert.equal(localizeCover([{ url: 'https://example.com/nope.jpg' }], assetMap), '');
    // 查表用原始远程 URL：head_image 的 opcstore 地址不在品牌标记表内，也不会被替换破坏
    assert.equal(
      localizeCover([{ url: 'https://www.opcstore.com/x.jpg' }], { 'https://www.opcstore.com/x.jpg': '/opc/assets/x.webp' }),
      '/opc/assets/x.webp',
    );
  });
});

describe('日期转换（epoch 秒 → ISO）', () => {
  test('epochSecondsToIso：已知值、无效值', () => {
    assert.equal(epochSecondsToIso(1792638177), '2026-10-22T03:02:57.000Z');
    assert.equal(epochSecondsToIso(0), null);
    assert.equal(epochSecondsToIso(-5), null);
    assert.equal(epochSecondsToIso(Number.NaN), null);
    assert.equal(epochSecondsToIso(undefined as unknown as number), null);
  });

  test('每行 published_at 与源 create_time 一致（×1000 毫秒口径）且可解析', () => {
    for (const [id, record] of Object.entries(snapshot.records) as [string, { category_id: number; create_time: number }][]) {
      if (!(record.category_id in LEGACY_CHANNEL_BY_CATEGORY_ID)) continue;
      const row = findRow(`opc-${id}`);
      assert.equal(row.published_at, new Date(record.create_time * 1000).toISOString());
      assert.ok(!Number.isNaN(Date.parse(row.published_at!)));
    }
  });

  test('契约样例：opc-392 的发布日期为 2026-10-22（烘焙卡日期一致）', () => {
    assert.ok(findRow('opc-392').published_at!.startsWith('2026-10-22'));
  });
});

describe('行形状与固定字段', () => {
  test('行只含 news_posts 的 9 个迁移列，且固定字段正确', () => {
    const expectedKeys = ['slug', 'title', 'summary', 'body', 'cover_url', 'category', 'author', 'status', 'published_at'].sort();
    for (const row of plan.rows) {
      assert.deepEqual(Object.keys(row).sort(), expectedKeys);
      assert.equal(row.status, 'published');
      assert.equal(row.author, '集智 AI');
      assert.ok(row.category === DEFAULT_CATEGORY_BY_CHANNEL.news || row.category === DEFAULT_CATEGORY_BY_CHANNEL.activity);
    }
  });

  test('计划排序确定性：published_at 降序', () => {
    const dates = plan.rows.map((row) => row.published_at ?? '');
    const sorted = [...dates].sort((a, b) => b.localeCompare(a));
    assert.deepEqual(dates, sorted);
  });
});
