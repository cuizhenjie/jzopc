#!/usr/bin/env node
/**
 * 管理后台账号管理 CLI（admin_users 表的唯一写入口之一，另一处是登录 API 的 last_login_at）。
 *
 * 用法（数据库连接读取 NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY，与站点部署同源）：
 *   ADMIN_PASSWORD='强密码' pnpm admin:create ops                    # 建号（显示名默认取用户名）
 *   ADMIN_PASSWORD='新密码' pnpm admin:create ops '运营同学' --reset   # 改密 / 改显示名
 *   pnpm admin:create ops --disable                                   # 停用账号（禁止登录）
 *   pnpm admin:create ops --enable                                    # 重新启用
 *
 * 密码来源（按优先级）：
 *   1. 环境变量 ADMIN_PASSWORD（推荐，避免终端回显）；
 *   2. 交互式输入（终端可见回显，仅本机应急用）。
 * 密码只以 scrypt 哈希写入数据库，明文不落库、不打日志。
 *
 * 哈希实现与 src/lib/admin/accounts.ts 保持同构（`scrypt:<saltHex>:<hashHex>`），
 * 由 test/admin-accounts.test.ts 的契约测试锁死两边一致 —— 改格式必须两处同步。
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { stdin as input, stdout as output } from 'node:process';
import readline from 'node:readline/promises';

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');

/* ── 与 src/lib/admin/accounts.ts 同构的哈希实现（契约测试锁死一致性）──────── */

export const PASSWORD_MIN_LENGTH = 8;
export const USERNAME_RE = /^[a-z0-9_-]{3,32}$/;

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return ['scrypt', salt.toString('hex'), hash.toString('hex')].join(':');
}

export function verifyPassword(password, stored) {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function passwordPolicyError(password) {
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
    return `密码至少 ${PASSWORD_MIN_LENGTH} 位`;
  }
  if (password.length > 128) return '密码过长（≤128 位）';
  return null;
}

export function usernamePolicyError(username) {
  if (!USERNAME_RE.test(username)) return '用户名需 3-32 位小写字母/数字/中划线/下划线';
  return null;
}

/** 建号写入的载荷（键集合由 test/admin-accounts.test.ts 对照 DDL 契约锁定）。 */
export function buildInsertPayload(username, displayName, password) {
  return {
    username: username.toLowerCase(),
    display_name: displayName || username,
    password_hash: hashPassword(password),
  };
}

/* ── CLI 主体（仅直接执行时运行，被测试 import 时不执行）─────────────────── */

async function readPasswordInteractive(username) {
  const rl = readline.createInterface({ input, output });
  console.warn('⚠ 未设置 ADMIN_PASSWORD 环境变量，转入交互输入（终端会回显，建议 Ctrl+C 后改用环境变量）。');
  const pw = await rl.question(`为账号 ${username} 设置密码（≥${PASSWORD_MIN_LENGTH} 位）: `);
  rl.close();
  return pw;
}

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const positional = args.filter((a) => !a.startsWith('--'));
  const username = (positional[0] ?? '').toLowerCase();
  const displayName = positional[1];
  const wantsPassword = !flags.has('--disable') && !flags.has('--enable');

  const usage = '用法: pnpm admin:create <username> [display_name] [--reset|--disable|--enable]（密码经 ADMIN_PASSWORD 或交互输入）';
  if (!username) {
    console.error(usage);
    process.exit(2);
  }
  const userErr = usernamePolicyError(username);
  if (userErr) {
    console.error(`✖ ${userErr}`);
    process.exit(2);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('✖ 缺少数据库连接：需要 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY（service key 是必须的，anon key 过不了 admin_users 的 RLS）。');
    process.exit(2);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  let password = null;
  if (wantsPassword) {
    password = process.env.ADMIN_PASSWORD || (await readPasswordInteractive(username));
    const pwErr = passwordPolicyError(password);
    if (pwErr) {
      console.error(`✖ ${pwErr}`);
      process.exit(2);
    }
  }

  const { data: existing, error: findErr } = await sb
    .from('admin_users')
    .select('id, username, display_name, is_active')
    .eq('username', username)
    .maybeSingle();
  if (findErr) {
    console.error(`✖ 查询失败：${findErr.message}（确认 0004_admin_users.sql 已在目标库执行）`);
    process.exit(1);
  }

  if (flags.has('--disable') || flags.has('--enable')) {
    if (!existing) {
      console.error(`✖ 账号 ${username} 不存在`);
      process.exit(1);
    }
    const is_active = flags.has('--enable');
    const { error } = await sb.from('admin_users').update({ is_active }).eq('id', existing.id);
    if (error) {
      console.error(`✖ 更新失败：${error.message}`);
      process.exit(1);
    }
    console.log(`✔ 账号 ${username} 已${is_active ? '启用' : '停用'}`);
    return;
  }

  if (existing && !flags.has('--reset')) {
    console.error(`✖ 账号 ${username} 已存在（${existing.display_name}）。改密请加 --reset。`);
    process.exit(1);
  }

  if (existing) {
    const patch = { password_hash: hashPassword(password), updated_at: new Date().toISOString() };
    if (displayName) patch.display_name = displayName;
    const { error } = await sb.from('admin_users').update(patch).eq('id', existing.id);
    if (error) {
      console.error(`✖ 改密失败：${error.message}`);
      process.exit(1);
    }
    console.log(`✔ 账号 ${username} 密码已重置${displayName ? `，显示名改为「${displayName}」` : ''}`);
    return;
  }

  const { error: insertErr } = await sb.from('admin_users').insert(
    buildInsertPayload(username, displayName, password),
  );
  if (insertErr) {
    console.error(`✖ 建号失败：${insertErr.message}`);
    process.exit(1);
  }
  console.log(`✔ 账号 ${username}（${displayName || username}）已创建，可在 /admin/login 登录`);
}

const invokedDirectly = import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  main().catch((err) => {
    console.error('✖ 执行出错：', err);
    process.exit(1);
  });
}
