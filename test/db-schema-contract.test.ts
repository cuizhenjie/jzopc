/**
 * 数据库契约校验：DDL（supabase/migrations/*.sql）与应用侧类型必须对齐。
 *
 * ## 为什么需要这条测试
 *
 * 2026-10-20 在**真实 PostgreSQL** 上执行迁移时发现一个会直接打挂线上页面的错配：
 *
 *   - DDL：`news_posts.body_md text`
 *   - 应用类型：`NewsPost.body: string[]`
 *   - 页面：新闻详情直接执行 `post.body.map(...)`（当时是 /news/[slug] 原生页；
 *     2026-10-26 后该页已下线，详情渲染收敛到 /newsdetail，走同一套类型）
 *
 * 接真库时 `post.body` 恒为 `undefined` → 新闻详情页抛错。
 * **本地完全看不出来** —— 因为「未配置 Supabase → 回落到本地种子数据」，
 * 种子里的 `body` 是数组，恰好能渲染。这条防线就是为这类「被兜底掩盖」的错配而设。
 *
 * 另外两个被同一次实测揪出来的问题也在这里锁住：
 *   - `route.ts` 插入的列必须都在 `leads` 表里存在；
 *   - `news_posts` 用 `status`、其余内容表用 `published`——可见性字段不能照抄。
 *
 * 本测试**不需要数据库**：直接解析迁移 SQL 的建表语句。
 * 需要真库的行为验证（RLS 实际拦截）见 `supabase/tests/001_migration_smoke.sql`。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
// 全量迁移拼接（0001 → 0004…）：后置迁移可以补建新表（如 0004 的 admin_users），
// 只读 0001 会漏掉它们。列定义以**最后出现的表**为准（后置迁移不 ALTER 既有列，可安全覆盖）。
const migrationDir = resolve(repoRoot, 'supabase/migrations');
const sql = readdirSync(migrationDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(resolve(migrationDir, f), 'utf8'))
  .join('\n');
const seedSrc = readFileSync(resolve(repoRoot, 'src/lib/data/seed.ts'), 'utf8');
// 2026-10-26 第二批清理后，agents/market/courses 的应用侧类型锚点从公开页
// seed 类型换成后台行类型（公开查询函数已随旧版原生页下线，管理后台是这三张
// 表的唯一直接消费方）；news 仍锚 seed 的 NewsPost（公开详情也在用）。
const adminResourcesSrc = readFileSync(resolve(repoRoot, 'src/lib/admin/resources.ts'), 'utf8');
const leadRouteSrc = readFileSync(resolve(repoRoot, 'src/app/api/leads/route.ts'), 'utf8');

/** 从迁移 SQL 解析出「表 → 列集合」（matchAll 迭代全部建表语句） */
function parseTables(source: string): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  for (const m of source.matchAll(/create table if not exists\s+(\w+)\s*\(([\s\S]*?)\n\);/g)) {
    const table = m[1];
    const cols = new Set<string>();
    for (const line of m[2].split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('--') || t.startsWith('unique') || t.startsWith('primary key')) continue;
      // "colname type ..." —— 取第一段标识符
      const cm = t.match(/^([a-z_][a-z0-9_]*)\s+/i);
      if (cm) cols.add(cm[1]);
    }
    tables.set(table, cols);
  }
  return tables;
}

/** 从 seed.ts / admin resources.ts 提取 `export type X = { field: ... }` 的字段集合 */
function typeFields(typeName: string): Set<string> {
  const block = [...[seedSrc, adminResourcesSrc].flatMap((src) =>
    [...src.matchAll(/export type (\w+) = \{([\s\S]*?)\n\};/g)].map((m) => m),
  )].find((m) => m[1] === typeName);
  assert.ok(block, `seed.ts / admin resources.ts 里找不到类型 ${typeName}`);
  const fields = new Set<string>();
  for (const line of block[2].split('\n')) {
    const fm = line.match(/^\s*([a-z_][a-z0-9_]*)\??\s*:/);
    if (fm) fields.add(fm[1]);
  }
  return fields;
}

const tables = parseTables(sql);

describe('数据库 DDL 与应用类型的契约', () => {
  test('12 张业务表全部在迁移脚本中定义', () => {
    assert.equal(tables.size, 12, `实际解析到 ${tables.size} 张表`);
  });

  // 这张表就是踩过坑的那张：body_md vs body
  // agents/market/courses 锚后台行类型（AdminXxxRow，snake_case 与 DDL 同形）；
  // news 锚公开类型 NewsPost（公开详情页在用）。
  const pairs: Array<[string, string]> = [
    ['agents', 'AdminAgentRow'],
    ['market_items', 'AdminMarketRow'],
    ['courses', 'AdminCourseRow'],
    ['news_posts', 'NewsPost'],
  ];

  for (const [table, type] of pairs) {
    test(`${table} 的每一列在应用类型 ${type} 里都有对应字段`, () => {
      const cols = tables.get(table);
      assert.ok(cols, `迁移脚本里没有 ${table} 表`);
      const fields = typeFields(type);
      const missing = [...fields].filter((f) => !cols.has(f));
      assert.deepEqual(
        missing,
        [],
        `${type} 的字段在 ${table} 表里不存在：${missing.join(', ')}` +
          `（应用侧按名取值，缺列会让该字段恒为 undefined）`,
      );
    });
  }

  test('正文字段在应用类型与 DDL 中同名且都是「段落数组」语义', () => {
    for (const [table, type] of pairs) {
      const fields = typeFields(type);
      if (!fields.has('body')) continue;
      const cols = tables.get(table)!;
      assert.ok(
        cols.has('body'),
        `${table} 表缺少 body 列（旧的 body_md text 与应用层 body: string[] 不同形）`,
      );
      assert.ok(
        !cols.has('body_md'),
        `${table} 表仍存在 body_md 列，会与应用层 body 字段错配`,
      );
    }
  });

  test('route.ts 插入的列在 leads 表里全部存在', () => {
    const cols = tables.get('leads');
    assert.ok(cols, '迁移脚本里没有 leads 表');

    // 抓 .from('leads').insert({ ... }) 里的字段名
    const insertBlock = leadRouteSrc.match(/from\('leads'\)[\s\S]*?\.insert\(\{([\s\S]*?)\n  \}\)/);
    assert.ok(insertBlock, 'route.ts 里找不到 leads 的 insert 语句');

    const inserted = [...insertBlock[1].matchAll(/^\s{4}([a-z_][a-z0-9_]*)\s*:/gm)].map((m) => m[1]);
    assert.ok(inserted.length > 0, '没解析出 insert 的字段');

    const missing = inserted.filter((c) => !cols.has(c));
    assert.deepEqual(
      missing,
      [],
      `route.ts 往 leads 插入了不存在的列：${missing.join(', ')}（整个 INSERT 会被 Postgres 拒绝）`,
    );
  });

  test('可见性字段各表不同：news_posts 用 status，其余内容表用 published', () => {
    // 这三张表没有 published 列，策略不能照抄
    for (const t of ['site_stats', 'agent_categories']) {
      assert.ok(
        !tables.get(t)!.has('published'),
        `${t} 不应有 published 列（RLS 策略用 using (true)）`,
      );
    }
    // news_posts 用 status
    assert.ok(tables.get('news_posts')!.has('status'), 'news_posts 应有 status 列');
    assert.ok(
      !tables.get('news_posts')!.has('published'),
      'news_posts 不应有 published 列（RLS 策略用 status = published）',
    );
    // 其余内容表用 published
    for (const t of [
      'site_contents',
      'empower_modules',
      'agents',
      'market_items',
      'courses',
      'partners',
    ]) {
      assert.ok(tables.get(t)!.has('published'), `${t} 应有 published 列`);
    }
  });

  test('leads 表带幂等键的部分唯一索引（route.ts 靠 23505 判重复提交）', () => {
    assert.match(
      sql,
      /create unique index if not exists leads_idempotency_idx[\s\S]*?where idempotency_key is not null/i,
      'leads 缺少 idempotency_key 的部分唯一索引',
    );
  });

  // ── 管理后台（/admin）的写入契约 ──────────────────────────────────────────
  // 后台新闻 CRUD 与线索 CSV 导出的列名都必须真实存在，否则 insert/update
  // 会被 Postgres 整条拒绝、导出会得到全空列。与上面 route.ts 的做法一致：
  // 静态解析源码里的列引用，对照 DDL。

  test('后台 toNewsRow 写入的列在 news_posts 表里全部存在', () => {
    const cols = tables.get('news_posts');
    assert.ok(cols, '迁移脚本里没有 news_posts 表');
    const newsSchemaSrc = readFileSync(resolve(repoRoot, 'src/lib/admin/news-schema.ts'), 'utf8');
    // toNewsRow 返回对象里的键：`    slug: input.slug,` 形式
    const rowKeys = [...newsSchemaSrc.matchAll(/^\s{4}([a-z_][a-z0-9_]*)\s*:/gm)].map((m) => m[1]);
    assert.ok(rowKeys.length >= 8, `没解析出 toNewsRow 的字段（实际 ${rowKeys.length}）`);
    const missing = rowKeys.filter((c) => !cols.has(c));
    assert.deepEqual(
      missing,
      [],
      `后台新闻写入引用了 news_posts 不存在的列：${missing.join(', ')}`,
    );
  });

  test('后台 CSV 导出列在 leads 表里全部存在', () => {
    const cols = tables.get('leads');
    assert.ok(cols, '迁移脚本里没有 leads 表');
    const dataSrc = readFileSync(resolve(repoRoot, 'src/lib/admin/data.ts'), 'utf8');
    // LEAD_CSV_COLUMNS 里的键：`{ key: 'id', label: 'ID' },` 形式
    const keys = [...dataSrc.matchAll(/key:\s*'([a-z_][a-z0-9_]*)'/g)].map((m) => m[1]);
    assert.ok(keys.length >= 15, `没解析出 CSV 列定义（实际 ${keys.length}）`);
    const missing = keys.filter((c) => !cols.has(c));
    assert.deepEqual(
      missing,
      [],
      `CSV 导出引用了 leads 不存在的列：${missing.join(', ')}`,
    );
  });

  test('账号体系登录查询的列在 admin_users 表里全部存在', () => {
    const cols = tables.get('admin_users');
    assert.ok(cols, '迁移脚本里没有 admin_users 表（缺 0004_admin_users.sql？）');

    const accountsSrc = readFileSync(resolve(repoRoot, 'src/lib/admin/accounts.ts'), 'utf8');
    const selectMatch = accountsSrc.match(/from\('admin_users'\)[\s\S]*?\.select\('([^']+)'\)/);
    assert.ok(selectMatch, 'accounts.ts 里找不到 admin_users 的 select 列表');
    const selected = selectMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
    const missing = selected.filter((c) => !cols.has(c));
    assert.deepEqual(missing, [], `登录查询引用了 admin_users 不存在的列：${missing.join(', ')}`);
    // 建号脚本写入列的契约见 test/admin-accounts.test.ts（import 脚本的 buildInsertPayload 后对照 DDL）
  });
});
