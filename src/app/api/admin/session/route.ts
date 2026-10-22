import { NextResponse } from 'next/server';
import { tokenMatches } from '@/lib/ops/auth';
import { clientIp, loginRateLimited, sessionCookie, clearSessionCookie } from '@/lib/admin/auth';
import {
  findAdminUser,
  passwordPolicyError,
  touchLastLogin,
  usernamePolicyError,
  verifyPassword,
} from '@/lib/admin/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 管理后台登录 / 登出。
 *
 * POST { username, password } → 管理员账号登录（admin_users 表，scrypt 校验）。
 * POST { token }               → OPS_TOKEN 恢复主口令（忘记密码时的兜底通道）。
 * DELETE                       → 登出（清会话 cookie）。
 *
 * 安全：IP 限流（15 分钟 5 次）；用户名错误 / 密码错误 / 账号停用返回**同一个**
 * 401 文案（不泄露「用户名存在与否」）；成功后下发 HMAC 签名的 httpOnly 会话。
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (loginRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, message: '尝试次数过多，请 15 分钟后再试。' },
      { status: 429 },
    );
  }

  let body: { username?: unknown; password?: unknown; token?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: '请求格式错误' }, { status: 400 });
  }

  /* ── 通道一：恢复主口令（OPS_TOKEN）────────────────────────────────────── */
  if (typeof body.token === 'string' && body.token.length > 0) {
    if (!process.env.OPS_TOKEN) {
      return NextResponse.json(
        { ok: false, message: '服务端未配置 OPS_TOKEN，主口令通道未开放；请使用管理员账号登录。' },
        { status: 503 },
      );
    }
    if (!tokenMatches(body.token)) {
      return NextResponse.json({ ok: false, message: '口令不正确。' }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, via: 'master' });
    res.headers.set(
      'Set-Cookie',
      sessionCookie({ uid: 0, username: 'master', displayName: '主口令会话', via: 'master' }),
    );
    return res;
  }

  /* ── 通道二：管理员账号 ─────────────────────────────────────────────────── */
  if (typeof body.username !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json(
      { ok: false, message: '请输入用户名和密码。', errors: { form: '请输入用户名和密码' } },
      { status: 400 },
    );
  }

  const username = body.username.trim().toLowerCase();
  const userError = usernamePolicyError(username);
  const passError = passwordPolicyError(body.password);
  if (userError || passError) {
    return NextResponse.json(
      { ok: false, message: '用户名或密码不正确。' },
      { status: 401 },
    );
  }

  const user = await findAdminUser(username);
  if (user === 'no-db') {
    return NextResponse.json(
      {
        ok: false,
        message: '账号登录需要连接数据库（未配置 Supabase）。可改用主口令登录，或先配置数据库。',
      },
      { status: 503 },
    );
  }

  // 用户不存在 / 密码不对 / 已停用 → 同一文案，不泄露可试探的信息
  const GENERIC_401 = NextResponse.json(
    { ok: false, message: '用户名或密码不正确。' },
    { status: 401 },
  );
  if (!user || !user.is_active || !verifyPassword(body.password, user.password_hash)) {
    return GENERIC_401;
  }

  void touchLastLogin(user.id); // 失败不影响登录

  const res = NextResponse.json({ ok: true, via: 'account', displayName: user.display_name });
  res.headers.set(
    'Set-Cookie',
    sessionCookie({
      uid: user.id,
      username: user.username,
      displayName: user.display_name,
      via: 'account',
    }),
  );
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.headers.set('Set-Cookie', clearSessionCookie());
  return res;
}
