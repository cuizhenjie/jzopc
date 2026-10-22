import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { tokenMatches } from '@/lib/ops/auth';
import {
  signSession,
  verifySessionToken,
  type AdminSession,
} from '@/lib/admin/accounts';

/**
 * 管理后台（/admin）的会话层。
 *
 * 会话凭据是 **HMAC 签名的自包含 token**（uid / 用户名 / 过期时间），
 * 以 httpOnly cookie 下发——cookie 里不含任何口令。
 * 登录通道有两个（见 /api/admin/session）：
 *   1. 管理员账号（admin_users 表，用户名 + scrypt 密码）—— 主通道；
 *   2. OPS_TOKEN 恢复主口令 —— 忘记密码 / 无可用账号时的兜底，可在环境变量清空以关闭。
 *
 * API 还接受 `x-ops-token` 请求头（值 = OPS_TOKEN），供脚本直连，等价于主口令登录。
 */

export const adminCookieName = 'jz_admin_session';

/** 会话有效期：7 天（仅内部运营使用，过期重新登录即可）。 */
export const ADMIN_SESSION_MAX_AGE = 7 * 24 * 60 * 60;

/** 服务端页面用：当前会话（含账号信息），未登录返回 null。 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(adminCookieName)?.value);
}

export async function isAdminAuthed(): Promise<boolean> {
  return (await getAdminSession()) !== null;
}

/**
 * API 路由用：未登录时直接返回 401 响应，调用方 `if (resp) return resp;` 即可。
 * 认 cookie（sameSite=lax + 仅接受 JSON body，可挡住跨站表单 CSRF）
 * 或 `x-ops-token` 头（= OPS_TOKEN，脚本通道）。
 */
export async function rejectIfUnauthedApi(req: Request): Promise<NextResponse | null> {
  const headerToken = req.headers.get('x-ops-token');
  if (tokenMatches(headerToken)) return null;
  if (await isAdminAuthed()) return null;
  return NextResponse.json({ ok: false, message: '未登录或会话已过期' }, { status: 401 });
}

/** 登录成功后下发会话 cookie（httpOnly + sameSite=lax；生产强制 secure）。 */
export function sessionCookie(session: Omit<AdminSession, 'exp'>): string {
  const token = signSession(session, ADMIN_SESSION_MAX_AGE);
  const parts = [
    `${adminCookieName}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${ADMIN_SESSION_MAX_AGE}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

/** 登出：清会话 cookie。 */
export function clearSessionCookie(): string {
  return `${adminCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/* ── 登录接口限流：与 src/app/api/leads 同款内存级实现（单实例够用）────────── */

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX = 5;
const attempts = new Map<string, number[]>();

export function loginRateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (attempts.get(ip) ?? []).filter((t) => now - t < LOGIN_WINDOW_MS);
  if (hits.length >= LOGIN_MAX) {
    attempts.set(ip, hits);
    return true;
  }
  hits.push(now);
  attempts.set(ip, hits);
  return false;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
