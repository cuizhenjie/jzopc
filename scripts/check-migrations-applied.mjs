#!/usr/bin/env node
/**
 * 生产库迁移执行状态核验（只读，2026-11-10）。
 *
 * 对 supabase/migrations/0001..0009 的每一条，用「该迁移独有的结构/数据事实」
 * 在真库上验证是否已生效（不靠 supabase_migrations 跟踪表——历史迁移是
 * 手工/psql 执行的，没有 CLI 留痕；结构事实才是 ground truth）。
 *
 * 用法：node scripts/check-migrations-applied.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

for (const f of ['.env.local', '.env']) {
  const p = resolve(f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('✗ 缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（检查 .env.local）');
  process.exit(2);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

/** 探一个列/表是否存在：head 请求，按 PostgREST 错误码判定。 */
async function probe(selectable) {
  const { error } = await sb.from(selectable).select('*', { head: true, count: 'exact' });
  if (!error) return { ok: true };
  const code = error.code ?? '';
  if (code === '42703' || code === 'PGRST205' || /does not exist/i.test(error.message)) {
    return { ok: false, message: error.message };
  }
  // 其它错误（如 42501 权限）不影响「对象存在」的判定
  return { ok: true, note: `(${code} ${error.message})` };
}

const results = [];
const check = (id, desc, ok, detail = '') =>
  results.push({ id, desc, ok, detail });

/* ── 0001 初始化：核心表存在 ─────────────────────────────────────────── */
for (const t of ['leads', 'market_items', 'news_posts', 'agents', 'courses', 'empower_modules']) {
  const p = await probe(t);
  check('0001', `表 ${t} 存在`, p.ok, p.detail ?? (p.ok ? '' : '表不存在'));
}

/* ── 0003 body_jsonb：market_items.body 是 jsonb 列（存在即可，旧 text 列名是 body_md）── */
{
  const p = await probe('market_items').then(() => sb.from('market_items').select('body', { head: true }));
  check('0003', 'market_items.body（jsonb）列存在', !p.error, p.error?.message ?? '');
}

/* ── 0004 管理员账号表 ───────────────────────────────────────────────── */
{
  const p = await probe('admin_users');
  check('0004', '表 admin_users 存在', p.ok, p.detail ?? (p.ok ? '' : '表不存在'));
}

/* ── 0005 模块种子：agent_categories / empower_modules / site_stats 有数据 ── */
for (const t of ['agent_categories', 'empower_modules', 'site_stats']) {
  const { count, error } = await sb.from(t).select('*', { head: true, count: 'exact' });
  check('0005', `${t} 种子数据已灌入`, !error && (count ?? 0) > 0, error?.message ?? `共 ${count ?? 0} 行`);
}

/* ── 0006 下线 site_contents：表必须不存在 ────────────────────────────── */
{
  const { error } = await sb.from('site_contents').select('section', { head: true });
  const gone = !!error && /does not exist/i.test(error.message);
  check('0006', 'site_contents 已 DROP', gone, gone ? '' : '表仍存在！');
}

/* ── 0007 首页 Banner 表 ─────────────────────────────────────────────── */
{
  const p = await probe('home_banners');
  check('0007', '表 home_banners 存在', p.ok, p.detail ?? (p.ok ? '' : '表不存在'));
}

/* ── 0008 地址口径：empower_modules 不再含旧地址 ─────────────────────── */
{
  const { data, error } = await sb.from('empower_modules').select('slug,hero_desc,highlights');
  if (error) check('0008', 'empower_modules 无旧地址残留', false, error.message);
  else {
    const stale = (data ?? []).filter(
      (r) => JSON.stringify(r).includes('北京丰台大红门') || JSON.stringify(r).includes('丰台 · 大红门'),
    );
    check('0008', 'empower_modules 地址已统一为新口径', stale.length === 0,
      stale.length ? `仍有旧地址：${stale.map((r) => r.slug).join(', ')}` : '');
  }
}

/* ── 0009 leads.form_payload（本次新增）────────────────────────────── */
{
  const { error } = await sb.from('leads').select('form_payload', { head: true });
  const ok = !error;
  check('0009', 'leads.form_payload 列存在（供需表单结构化数据入库依赖）', ok,
    ok ? '' : `列不存在：${error?.code} ${error?.message}`);
}

/* ── 汇总 ─────────────────────────────────────────────────────────────── */
console.log('\n迁移执行状态核验结果');
console.log('─'.repeat(72));
let fail = 0;
for (const r of results) {
  const mark = r.ok ? '✔' : '✗';
  if (!r.ok) fail++;
  console.log(`${mark} ${r.id}  ${r.desc}${r.detail ? `  — ${r.detail}` : ''}`);
}
console.log('─'.repeat(72));
console.log(fail === 0 ? '全部迁移均已生效。' : `有 ${fail} 项未生效（见上表 ✗）。`);
process.exit(fail === 0 ? 0 : 1);
