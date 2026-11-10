#!/usr/bin/env node
/** 一次性脚本：把 empower_modules 存量行的旧地址刷成新地址（2026-11-10）。 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    }),
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('缺少 Supabase 配置');

const sb = createClient(url, key, { auth: { persistSession: false } });
const NEW_ADDR = '北京市丰台区集美家居大红门店3号厅2层 集智OPC社区';

// 先查旧地址残留
const { data: rows } = await sb.from('empower_modules').select('slug, hero_desc, highlights');
console.log('总行数:', rows?.length ?? 0);
for (const row of rows ?? []) {
  const hd = row.hero_desc ?? '';
  const hl = JSON.stringify(row.highlights ?? '');
  if (hd.includes('大红门') && !hd.includes('集美家居') || hl.includes('大红门') && !hl.includes('集美家居')) {
    console.log('待更新:', row.slug);
  }
}

const { data: updated, error } = await sb.rpc?.('') ?? {};
void updated;

// supabase-js 没有通用 rpc replace，直接逐行 update
let fixed = 0;
for (const row of rows ?? []) {
  const patch = {};
  if ((row.hero_desc ?? '').includes('北京丰台大红门')) {
    patch.hero_desc = row.hero_desc.split('北京丰台大红门').join(NEW_ADDR);
  }
  const hl = JSON.stringify(row.highlights ?? '');
  if (hl.includes('丰台 · 大红门')) {
    patch.highlights = JSON.parse(hl.split('丰台 · 大红门').join(NEW_ADDR));
  }
  if (Object.keys(patch).length) {
    const { error: upErr } = await sb.from('empower_modules').update(patch).eq('slug', row.slug);
    if (upErr) throw new Error(`更新 ${row.slug} 失败: ${upErr.message}`);
    fixed += 1;
    console.log('已更新:', row.slug);
  }
}
console.log(`完成，共更新 ${fixed} 行`);

// 复核查
const { data: after } = await sb.from('empower_modules').select('slug, hero_desc, highlights');
const left = (after ?? []).filter((r) =>
  (r.hero_desc ?? '').includes('大红门') && !(r.hero_desc ?? '').includes('集美家居')
  || JSON.stringify(r.highlights ?? '').includes('大红门') && !JSON.stringify(r.highlights ?? '').includes('集美家居'));
console.log('残留旧地址行数:', left.length);
