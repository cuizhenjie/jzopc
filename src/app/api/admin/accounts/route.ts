import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rejectIfUnauthedApi, getAdminSession } from '@/lib/admin/auth';
import {
  adminAccountCreateSchema,
  adminAccountPatchSchema,
} from '@/lib/admin/resources';
import { zodFieldErrors } from '@/lib/admin/news-schema';
import { hashPassword, usernamePolicyError, passwordPolicyError } from '@/lib/admin/accounts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 管理员账号管理（admin_users 表）。
 *
 *   GET    账号列表（绝不出 password_hash）
 *   POST   创建账号（scrypt 哈希与 create-admin.mjs / accounts.ts 同构）
 *   PATCH  {id, display_name?/password?/is_active?} —— 改显示名 / 重置密码 / 启停
 *   DELETE ?id=xxx 删除账号
 *
 * 自我保护守卫（防止把自己锁在门外）：
 *   - 不能删除 / 停用**当前登录账号自己**；
 *   - 不能停用或删除**最后一个启用中的账号**。
 */

const LIST_COLUMNS = 'id, username, display_name, is_active, last_login_at, created_at';

export async function GET(req: Request) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, message: '未连接数据库' }, { status: 503 });

  const { data, error } = await sb.from('admin_users').select(LIST_COLUMNS).order('id');
  if (error) {
    console.error('[admin:accounts-list-failed]', error);
    return NextResponse.json({ ok: false, message: '读取失败' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: '请求格式错误' }, { status: 400 });
  }
  const parsed = adminAccountCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: '请检查填写是否完整。', errors: zodFieldErrors(parsed.error.issues) },
      { status: 400 },
    );
  }
  // 与登录 API 同一策略文案（长度规则 zod 已覆盖，这里补齐历史口径以防漂移）
  const policyError = usernamePolicyError(parsed.data.username) ?? passwordPolicyError(parsed.data.password);
  if (policyError) {
    return NextResponse.json({ ok: false, message: policyError }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, message: '未连接数据库，无法保存' }, { status: 503 });

  const { error } = await sb.from('admin_users').insert({
    username: parsed.data.username,
    display_name: parsed.data.display_name,
    password_hash: hashPassword(parsed.data.password),
  });
  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { ok: false, message: '保存冲突。', errors: { username: '该用户名已存在' } },
        { status: 409 },
      );
    }
    console.error('[admin:accounts-create-failed]', error);
    return NextResponse.json({ ok: false, message: '保存失败，请稍后重试。' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

async function activeCount(sb: NonNullable<ReturnType<typeof getSupabaseAdmin>>): Promise<number> {
  const { count, error } = await sb
    .from('admin_users')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  if (error) throw error;
  return count ?? 0;
}

export async function PATCH(req: Request) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  let body: { id?: unknown } & Record<string, unknown>;
  try {
    body = (await req.json()) as { id?: unknown } & Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: '请求格式错误' }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: '参数不合法' }, { status: 400 });
  }

  const parsed = adminAccountPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: '请检查填写是否完整。', errors: zodFieldErrors(parsed.error.issues) },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, message: '未连接数据库，无法保存' }, { status: 503 });

  const patch: Record<string, unknown> = {};
  if (parsed.data.display_name !== undefined) patch.display_name = parsed.data.display_name;
  if (parsed.data.password !== undefined) patch.password_hash = hashPassword(parsed.data.password);
  if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, message: '没有要更新的字段' }, { status: 400 });
  }

  // 守卫：停用自己 / 停用最后一个启用账号都被拒
  const session = await getAdminSession();
  if (parsed.data.is_active === false) {
    if (session && session.uid === id) {
      return NextResponse.json({ ok: false, message: '不能停用当前登录的账号。' }, { status: 409 });
    }
    const active = await activeCount(sb).catch(() => -1);
    if (active >= 0) {
      const { data: target } = await sb.from('admin_users').select('is_active').eq('id', id).maybeSingle();
      if (target?.is_active && active <= 1) {
        return NextResponse.json({ ok: false, message: '至少保留一个启用中的管理员账号。' }, { status: 409 });
      }
    }
  }

  const { data, error } = await sb.from('admin_users').update(patch).eq('id', id).select('id').limit(1);
  if (error) {
    console.error('[admin:accounts-update-failed]', error);
    return NextResponse.json({ ok: false, message: '更新失败' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ ok: false, message: '记录不存在' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, message: '参数不合法' }, { status: 400 });
  }

  const session = await getAdminSession();
  if (session && session.uid === id) {
    return NextResponse.json({ ok: false, message: '不能删除当前登录的账号。' }, { status: 409 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) return NextResponse.json({ ok: false, message: '未连接数据库' }, { status: 503 });

  // 守卫：不能删除最后一个启用中的账号
  const { data: target } = await sb.from('admin_users').select('is_active').eq('id', id).maybeSingle();
  if (target?.is_active) {
    const active = await activeCount(sb).catch(() => -1);
    if (active >= 0 && active <= 1) {
      return NextResponse.json({ ok: false, message: '至少保留一个启用中的管理员账号。' }, { status: 409 });
    }
  }

  const { data, error } = await sb.from('admin_users').delete().eq('id', id).select('id').limit(1);
  if (error) {
    console.error('[admin:accounts-delete-failed]', error);
    return NextResponse.json({ ok: false, message: '删除失败' }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ ok: false, message: '记录不存在' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
