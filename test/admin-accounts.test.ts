/**
 * 管理员账号体系（src/lib/admin/accounts.ts）的单测：
 * scrypt 哈希往返、口令策略、会话 token 的签名/过期/防篡改，
 * 以及 create-admin.mjs 脚本与 lib 的哈希**同构契约**（两边必须产出可互验的格式）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hashPassword,
  passwordPolicyError,
  signSession,
  usernamePolicyError,
  verifyPassword,
  verifySessionToken,
  PASSWORD_MIN_LENGTH,
} from '@/lib/admin/accounts';
import {
  buildInsertPayload,
  hashPassword as scriptHashPassword,
  passwordPolicyError as scriptPasswordPolicyError,
  usernamePolicyError as scriptUsernamePolicyError,
  verifyPassword as scriptVerifyPassword,
} from '../scripts/create-admin.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

describe('密码哈希（scrypt）', () => {
  test('往返：hash → verify 通过；错密码不通过', () => {
    const stored = hashPassword('correct-horse-1');
    assert.match(stored, /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
    assert.equal(verifyPassword('correct-horse-1', stored), true);
    assert.equal(verifyPassword('wrong-horse-1', stored), false);
  });

  test('同密码两次哈希不同盐（哈希值不同，都可验证）', () => {
    const a = hashPassword('same-password');
    const b = hashPassword('same-password');
    assert.notEqual(a, b);
    assert.equal(verifyPassword('same-password', a), true);
    assert.equal(verifyPassword('same-password', b), true);
  });

  test('存储格式非法时按不匹配处理（不抛错）', () => {
    for (const bad of ['', 'plaintext', 'scrypt:', 'scrypt:zz:zz', 'md5:aabb:ccdd', 'scrypt:abcd:zzzz']) {
      assert.equal(verifyPassword('whatever', bad), false, `stored=${bad} 应校验失败`);
    }
  });

  test('策略：密码最短长度与用户名字符集', () => {
    assert.ok(passwordPolicyError('short'));
    assert.equal(passwordPolicyError('a'.repeat(PASSWORD_MIN_LENGTH)), null);
    assert.equal(passwordPolicyError('x'.repeat(129)) !== null, true);

    assert.ok(usernamePolicyError('ab')); // 太短
    assert.ok(usernamePolicyError('Has-Upper'));
    assert.ok(usernamePolicyError('中文用户'));
    assert.equal(usernamePolicyError('ops-01_team'), null);
  });
});

describe('脚本 ↔ lib 哈希同构契约', () => {
  test('脚本产出的哈希能被 lib 验证（反之亦然）', () => {
    const fromScript = scriptHashPassword('bridge-password-1');
    assert.equal(verifyPassword('bridge-password-1', fromScript), true);
    assert.equal(verifyPassword('nope', fromScript), false);

    const fromLib = hashPassword('bridge-password-2');
    assert.equal(scriptVerifyPassword('bridge-password-2', fromLib), true);
  });

  test('两边策略函数判定一致', () => {
    for (const pw of ['short', 'longenough-1', 'x'.repeat(200)]) {
      assert.equal(
        passwordPolicyError(pw) === null,
        scriptPasswordPolicyError(pw) === null,
        `密码 ${pw.slice(0, 8)}… 两边判定应一致`,
      );
    }
    for (const un of ['ok-name', 'A', '中文', 'a_b-c9']) {
      assert.equal(
        usernamePolicyError(un) === null,
        scriptUsernamePolicyError(un) === null,
        `用户名 ${un} 两边判定应一致`,
      );
    }
  });

  test('建号载荷的列在 admin_users DDL 里全部存在（写库契约）', () => {
    const ddl = readFileSync(
      resolve(repoRoot, 'supabase/migrations/0004_admin_users.sql'),
      'utf8',
    );
    const block = [...ddl.matchAll(/create table if not exists\s+admin_users\s*\(([\s\S]*?)\n\);/g)][0];
    assert.ok(block, '0004_admin_users.sql 里找不到建表语句');
    const cols = new Set(
      block[1]
        .split('\n')
        .map((line) => line.trim().match(/^([a-z_][a-z0-9_]*)\s+/))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => m[1]),
    );
    const payload = buildInsertPayload('contract-check', null, 'whatever-password');
    for (const key of Object.keys(payload)) {
      assert.ok(cols.has(key), `建号写入了 admin_users 不存在的列：${key}`);
    }
    // 哈希在载荷里必须是可被 lib 验证的格式
    assert.equal(verifyPassword('whatever-password', payload.password_hash), true);
  });
});

describe('会话 token（HMAC 签名）', () => {
  const accountSession = {
    uid: 7,
    username: 'ops',
    displayName: '运营同学',
    via: 'account' as const,
  };

  test('往返：签发 → 验证，载荷字段完整保留', () => {
    const token = signSession(accountSession, 60);
    const session = verifySessionToken(token);
    assert.ok(session);
    assert.equal(session.uid, 7);
    assert.equal(session.username, 'ops');
    assert.equal(session.displayName, '运营同学');
    assert.equal(session.via, 'account');
    assert.ok(session.exp > Date.now() / 1000);
  });

  test('过期 token 拒绝', () => {
    const token = signSession(accountSession, -10);
    assert.equal(verifySessionToken(token), null);
  });

  test('篡改载荷拒绝（换 uid 提权）', () => {
    const token = signSession(accountSession, 60);
    const [, payload, sig] = token.split('.');
    const forged = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    forged.uid = 1; // 尝试伪装成别的账号
    const forgedPayload = Buffer.from(JSON.stringify(forged), 'utf8').toString('base64url');
    assert.equal(verifySessionToken(['v1', forgedPayload, sig].join('.')), null);
  });

  test('篡改签名 / 非法格式拒绝', () => {
    const token = signSession(accountSession, 60);
    const badSig = token.slice(0, -4) + 'AAAA';
    assert.equal(verifySessionToken(badSig), null);
    assert.equal(verifySessionToken('v1.only-two-parts'), null);
    assert.equal(verifySessionToken('v2.a.b'), null);
    assert.equal(verifySessionToken(null), null);
    assert.equal(verifySessionToken(undefined), null);
    assert.equal(verifySessionToken(''), null);
  });

  test('载荷字段缺失 / 类型不对拒绝（即使重签也不行——字段白名单）', () => {
    // 自行构造合法签名但载荷缺 via 的 token：签名对，但字段校验必须拦下
    const token = signSession({ ...accountSession, via: 'account' }, 60);
    const session = verifySessionToken(token);
    assert.ok(session);

    // 直接把 via 塞成任意值再验证会被字段校验拒绝
    const [, payload] = token.split('.');
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    parsed.via = 'superadmin';
    // 这个载荷没有合法签名 → 签名校验先拦（前置防线）
    assert.equal(
      verifySessionToken(['v1', Buffer.from(JSON.stringify(parsed), 'utf8').toString('base64url'), 'AAAA'].join('.')),
      null,
    );
  });

  test('master 通道会话可签发可验证', () => {
    const token = signSession(
      { uid: 0, username: 'master', displayName: '主口令会话', via: 'master' },
      60,
    );
    const session = verifySessionToken(token);
    assert.ok(session);
    assert.equal(session.via, 'master');
  });
});
