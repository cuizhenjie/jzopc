import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { getSupabaseAdmin } from '@/lib/supabase/server';

/**
 * 管理员账号体系（兑现 README 技术债 R1 的账号化部分）。
 *
 * - 密码：node:crypto scrypt（每账号独立盐），库里只存 `scrypt:<saltHex>:<hashHex>`；
 * - 会话：HMAC-SHA256 签名的自包含 token（uid/用户名/过期时间），
 *   cookie 里**不再存任何口令**——比上一版「cookie 存 OPS_TOKEN 明文」更安全；
 * - 签名密钥从环境变量里的既有服务端密钥派生（零新增配置），同环境多实例一致。
 *
 * 建号 / 改密 / 停用：`pnpm admin:create`（scripts/create-admin.mjs）。
 */

/* ── 密码哈希 ─────────────────────────────────────────────────────────────── */

export const PASSWORD_MIN_LENGTH = 8;
export const USERNAME_RE = /^[a-z0-9_-]{3,32}$/;

/** 生成 `scrypt:<saltHex>:<hashHex>`（盐 16B，派生键 64B，scrypt 默认成本参数）。 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return ['scrypt', salt.toString('hex'), hash.toString('hex')].join(':');
}

/** 校验密码；存储格式非法时按「不匹配」处理（不抛错、不泄露原因）。 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function passwordPolicyError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `密码至少 ${PASSWORD_MIN_LENGTH} 位`;
  if (password.length > 128) return '密码过长（≤128 位）';
  return null;
}

export function usernamePolicyError(username: string): string | null {
  if (!USERNAME_RE.test(username)) return '用户名需 3-32 位小写字母/数字/中划线/下划线';
  return null;
}

/* ── 会话 token（自包含 + HMAC 签名）──────────────────────────────────────── */

export type AdminSession = {
  uid: number;
  username: string;
  displayName: string;
  /** 登录通道：account = 管理员账号；master = OPS_TOKEN 恢复主口令 */
  via: 'account' | 'master';
  exp: number; // Unix 秒
};

/** 会话 token 的版本前缀（v1 起步，未来换签名算法时递增）。 */
const TOKEN_VERSION = 'v1';

/**
 * 签名密钥：从既有服务端密钥派生。任一密钥轮换（换 Supabase key / OPS_TOKEN）
 * 会使所有已发会话失效——这正是密钥轮换期望的语义。
 */
function sessionSecret(): Buffer {
  const material = [
    'jz-admin-session-v1',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    process.env.OPS_TOKEN ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  ].join('|');
  return createHash('sha256').update(material).digest();
}

/** 对 payload 计算版本化 HMAC 签名（base64url）。 */
function signPayload(secret: Buffer, payloadB64: string): string {
  const message = [TOKEN_VERSION, payloadB64].join('.');
  return createHmac('sha256', secret).update(message).digest().toString('base64url');
}

/** 签发会话 token：`v1.<payloadB64url>.<sigB64url>`。 */
export function signSession(session: Omit<AdminSession, 'exp'>, maxAgeSec: number): string {
  const full: AdminSession = { ...session, exp: Math.floor(Date.now() / 1000) + maxAgeSec };
  const payload = Buffer.from(JSON.stringify(full), 'utf8').toString('base64url');
  const sig = signPayload(sessionSecret(), payload);
  return [TOKEN_VERSION, payload, sig].join('.');
}

/**
 * 验证会话 token：签名不符 / 过期 / 格式非法 → null（不抛错）。
 * 常量时间比较签名，防时序侧信道。
 */
export function verifySessionToken(token: string | undefined | null): AdminSession | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  const payloadB64 = parts[1];
  const sig = Buffer.from(parts[2], 'base64url');
  if (sig.length === 0) return null;

  const expected = Buffer.from(signPayload(sessionSecret(), payloadB64), 'base64url');
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as AdminSession;
    if (
      typeof session.uid !== 'number' ||
      typeof session.username !== 'string' ||
      typeof session.displayName !== 'string' ||
      (session.via !== 'account' && session.via !== 'master') ||
      typeof session.exp !== 'number'
    ) {
      return null;
    }
    if (session.exp * 1000 <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

/* ── admin_users 数据访问（service_role）──────────────────────────────────── */

export type AdminUserRow = {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  is_active: boolean;
  last_login_at: string | null;
};

/**
 * 按用户名查账号（用户名统一小写化再查，登录输入大小写不敏感）。
 * 未连接数据库 → 返回 'no-db'（调用方给「账号登录需连接数据库」提示）。
 */
export async function findAdminUser(username: string): Promise<AdminUserRow | null | 'no-db'> {
  const sb = getSupabaseAdmin();
  if (!sb) return 'no-db';
  const normalized = username.trim().toLowerCase();
  const { data, error } = await sb
    .from('admin_users')
    .select('id, username, display_name, password_hash, is_active, last_login_at')
    .eq('username', normalized)
    .maybeSingle();
  if (error) {
    console.error(`[admin:accounts] 查询账号失败：${error.message}`);
    return null;
  }
  return (data as AdminUserRow) ?? null;
}

/** 登录成功后刷新 last_login_at（失败不影响登录主流程）。 */
export async function touchLastLogin(id: number): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error } = await sb.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', id);
  if (error) console.error(`[admin:accounts] 更新 last_login_at 失败：${error.message}`);
}
