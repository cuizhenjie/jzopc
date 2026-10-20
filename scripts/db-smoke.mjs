#!/usr/bin/env node
/**
 * 数据库迁移冒烟测试 —— 一条命令跑完。
 *
 * 作用：起一个**一次性**的 PostgreSQL 集群，把 `supabase/migrations/*.sql`
 * 逐字执行一遍，再跑 `supabase/tests/001_migration_smoke.sql` 的断言，
 * 最后无论成败都把集群清理掉。
 *
 * 为什么需要它：本项目的「未配置 Supabase → 回落到本地种子数据」兜底，
 * 会把列名错配、类型不匹配、约束不生效这一整类问题**完全掩盖**。
 * 2026-10-20 就是在真库上才发现 `news_posts.body_md`（text）与应用层
 * `body: string[]` 的错配 —— 接真库时新闻详情页会直接抛错。
 *
 * 用法：
 *   node scripts/db-smoke.mjs
 *   PG_BIN=/opt/homebrew/opt/postgresql@16/bin node scripts/db-smoke.mjs
 *
 * 退出码：0 = 全部断言通过；非 0 = 有断言失败或迁移执行失败。
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const PG_BIN = process.env.PG_BIN ?? '';
const PORT = Number(process.env.PG_SMOKE_PORT ?? 55433);

const bin = (name) => (PG_BIN ? join(PG_BIN, name) : name);
const migrationsDir = resolve(repoRoot, 'supabase/migrations');
const smokeFile = resolve(repoRoot, 'supabase/tests/001_migration_smoke.sql');

/* ── 环境检查 ─────────────────────────────────────────────────────────── */
for (const cmd of ['initdb', 'pg_ctl', 'psql']) {
  if (spawnSync(bin(cmd), ['--version'], { stdio: 'ignore' }).status !== 0) {
    console.error(`✗ 找不到 ${cmd}。请安装 PostgreSQL，或用 PG_BIN 指定其 bin 目录。`);
    console.error(`  例：PG_BIN=/opt/homebrew/opt/postgresql@16/bin node scripts/db-smoke.mjs`);
    process.exit(2);
  }
}
if (!existsSync(smokeFile)) {
  console.error(`✗ 找不到冒烟测试文件：${smokeFile}`);
  process.exit(2);
}

const workDir = mkdtempSync(join(tmpdir(), 'jizhi-db-smoke-'));
const dataDir = join(workDir, 'data');
const sockDir = join(workDir, 'sock');
// pg_ctl 不会自建 socket 目录，必须先建好
mkdirSync(sockDir, { recursive: true });

/** 把命令输出打到终端（失败时保留完整上下文） */
function run(cmd, args, { quiet = false } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  // psql 的 NOTICE 走 stderr，RAISE 的 [PASS]/[FAIL] 也在 stderr —— 两者都要看
  const combined = (r.stdout ?? '') + (r.stderr ?? '');
  if (!quiet) process.stdout.write(combined);
  if (r.status !== 0) {
    if (quiet) process.stderr.write(combined);
    throw new Error(`${cmd} ${args.join(' ')} 退出码 ${r.status}`);
  }
  return combined;
}

const psql = (db, args, opts = {}) =>
  run(bin('psql'), ['-h', sockDir, '-p', String(PORT), '-U', 'postgres', '-d', db, ...args], opts);

function cleanup() {
  try {
    spawnSync(bin('pg_ctl'), ['-D', dataDir, '-m', 'immediate', 'stop'], { stdio: 'ignore' });
  } catch {
    /* 忽略 */
  }
  try {
    rmSync(workDir, { recursive: true, force: true });
  } catch {
    /* 忽略 */
  }
}

let failed = false;
try {
  console.log(`▸ 初始化一次性集群：${workDir}`);
  run(bin('initdb'), ['-D', dataDir, '-U', 'postgres', '--encoding=UTF8', '--locale=C'], { quiet: true });
  run(
    bin('pg_ctl'),
    ['-D', dataDir, '-o', `-p ${PORT} -k ${sockDir} -c listen_addresses=''`, '-l', join(workDir, 'pg.log'), '-w', 'start'],
    { quiet: true },
  );

  console.log('▸ 创建 Supabase 内置角色（anon / authenticated / service_role）');
  psql('postgres', [
    '-q',
    '-c',
    'create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;',
  ]);

  console.log('▸ 逐字执行迁移脚本');
  const files = execFileSync('ls', [migrationsDir], { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    console.log(`  → ${file}`);
    psql('postgres', ['-q', '-v', 'ON_ERROR_STOP=1', '-f', join(migrationsDir, file)]);
  }

  console.log('▸ 执行冒烟测试断言');
  const out = psql('postgres', ['-q', '-v', 'ON_ERROR_STOP=1', '-f', smokeFile], { quiet: true });
  const pass = (out.match(/\[PASS\]/g) ?? []).length;
  const fail = (out.match(/\[FAIL\]/g) ?? []).length;
  for (const line of out.split('\n')) {
    const m = line.match(/NOTICE:\s+\[(PASS|FAIL)\].*/);
    if (m) console.log('  ' + m[0].replace('NOTICE:  ', ''));
  }
  console.log(`\n${fail === 0 ? '✓' : '✗'} 断言：${pass} 通过 / ${fail} 失败`);
  failed = fail > 0;
} catch (e) {
  failed = true;
  console.error(`\n✗ 执行失败：${e.message}`);
} finally {
  cleanup();
  console.log('▸ 一次性集群已清理');
}

process.exit(failed ? 1 : 0);
