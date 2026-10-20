import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import {
  leadSchema,
  validateContact,
  requiresAgreement,
  AGREEMENT_REQUIRED_MESSAGE,
  type LeadInput,
} from '@/lib/lead/schema';
import { notify } from '@/lib/lead/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ── 内存级限流（单实例够用；多实例部署需换 Redis/KV）──────────────────── */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 3;
const rate = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (rate.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_MAX) {
    rate.set(ip, hits);
    return true;
  }
  hits.push(now);
  rate.set(ip, hits);
  return false;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/* ── 幂等窗口 ────────────────────────────────────────────────────────────────
 * `leads.idempotency_key` 上是**全局部分唯一索引**
 * （supabase/migrations/0001_init.sql：unique index ... where idempotency_key is not null），
 * 数据库层面**没有**「30 分钟窗口」的概念——只要键相同，无论隔多久都会冲突。
 *
 * 这里在服务端补上窗口语义：
 *   - 命中唯一冲突，且同键记录的 created_at 在 30 分钟内
 *     → 判定为「同一次提交被重复点击 / 网络重试」→ 视为成功，不重复入库；
 *   - 命中唯一冲突，但同键记录已超过 30 分钟
 *     → 判定为「键已过期」。此时用户是**重新提交**（新的诉求、新的内容），
 *     若仍当重复提交处理，这条线索会被静默吞掉、运营永远看不到。
 *     所以换一把新键重新落库：老记录保留（它是一条真实的历史线索），
 *     新记录独立入库（用户诉求不丢）。
 */
const IDEMPOTENCY_WINDOW_MS = 30 * 60 * 1000;

/**
 * 写入一条线索。
 *
 * 字段名与 `leads` 表严格一一对应（supabase/migrations/0001_init.sql），
 * test/db-schema-contract.test.ts 会解析这段 insert 校验列名是否存在 —— 不要改写它的形状。
 */
async function insertLead(
  sb: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  data: LeadInput,
  idempotencyKey: string | null,
) {
  return sb.from('leads').insert({
    lead_type: data.leadType,
    name: data.name,
    contact_type: data.contactType,
    contact: data.contact,
    org_name: data.orgName || null,
    role: data.role || null,
    subject_type: data.subjectType || null,
    team_size: data.teamSize ?? null,
    track: data.track || null,
    message: data.message || null,
    source_page: data.sourcePage,
    source_ref: data.sourceRef || null,
    idempotency_key: idempotencyKey,
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: '请求格式错误' }, { status: 400 });
  }

  // 蜜罐优先判定：真实用户看不到该字段，机器人会填。
  // 有值则静默返回成功（不落库、不报错），避免向机器人暴露拦截逻辑。
  const rawCompany = (body as Record<string, unknown> | null)?.company;
  if (typeof rawCompany === 'string' && rawCompany.trim().length > 0) {
    return NextResponse.json({ ok: true, message: '提交成功' });
  }

  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!errors[key]) errors[key] = issue.message;
    }
    return NextResponse.json(
      { ok: false, message: '请检查表单填写是否完整。', errors },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const contactError = validateContact(data.contactType, data.contact);
  if (contactError) {
    return NextResponse.json(
      { ok: false, message: contactError, errors: { contact: contactError } },
      { status: 400 },
    );
  }

  // 申请入驻必须勾选同意入驻须知（FR-APPLY-01 / FR-APPLY-03）。
  // 客户端已禁用按钮，这里再校验一次：按钮禁用可以被绕过（脚本直接发请求）。
  if (requiresAgreement(data.leadType) && data.agreeTerms !== true) {
    return NextResponse.json(
      {
        ok: false,
        message: AGREEMENT_REQUIRED_MESSAGE,
        errors: { agreeTerms: AGREEMENT_REQUIRED_MESSAGE },
      },
      { status: 400 },
    );
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, message: '提交过于频繁，请 10 分钟后再试，或直接电话联系我们。' },
      { status: 429 },
    );
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    // 未配置 Supabase：本地开发态不丢数据，写入控制台便于调试
    console.info('[lead:no-db]', {
      leadType: data.leadType,
      name: data.name,
      contact: data.contact,
      sourcePage: data.sourcePage,
    });
    return NextResponse.json({ ok: true, message: '提交成功（本地开发模式，未连接数据库）' });
  }

  const { error } = await insertLead(sb, data, data.idempotencyKey || null);

  if (error) {
    // 幂等键冲突 = 同一把键被用过：按「窗口内重复 / 窗口外过期」分别处理
    if (error.code === '23505') {
      return handleIdempotencyConflict(sb, data);
    }
    console.error('[lead:insert-failed]', error);
    return NextResponse.json(
      { ok: false, message: '提交失败，请稍后重试或直接电话联系我们。' },
      { status: 500 },
    );
  }

  // 通知失败不回滚入库
  void notify(data);

  return NextResponse.json({ ok: true, message: '提交成功' });
}

/**
 * 命中幂等键唯一冲突（Postgres 23505）时的处理。
 *
 * 判据是**同键记录的时间戳**，不是「有没有键」：
 *   - 30 分钟内 → 同一次提交（重复点击 / 网络重试）→ 视为成功，不重复入库；
 *   - 超过 30 分钟 → 键已过期，用户是重新提交 → 换新键重新落库，诉求不丢。
 */
async function handleIdempotencyConflict(
  sb: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  data: LeadInput,
): Promise<NextResponse> {
  const key = data.idempotencyKey;
  if (!key) {
    // 没带键却撞唯一索引：不可能是幂等重复，按普通失败处理（不假装成功）
    console.error('[lead:idempotency-conflict-without-key]');
    return NextResponse.json(
      { ok: false, message: '提交失败，请稍后重试或直接电话联系我们。' },
      { status: 500 },
    );
  }

  const { data: existing, error: lookupError } = await sb
    .from('leads')
    .select('id, created_at')
    .eq('idempotency_key', key)
    .maybeSingle();

  if (lookupError) {
    // 读不到原记录 → 无法判断是否过期 → 保守按重复提交处理（不制造重复行）
    console.error('[lead:idempotency-lookup-failed]', lookupError);
    return NextResponse.json({ ok: true, message: '提交成功' });
  }

  if (!existing) {
    // 唯一索引保证同键必有行；读不到说明这次读不可信，同样按重复提交处理
    console.error('[lead:idempotency-record-missing]', { key });
    return NextResponse.json({ ok: true, message: '提交成功' });
  }

  const createdAt = existing.created_at ? new Date(existing.created_at).getTime() : NaN;
  const ageMs = Date.now() - createdAt;
  const withinWindow = Number.isFinite(ageMs) && ageMs < IDEMPOTENCY_WINDOW_MS;

  if (withinWindow) {
    // 窗口内 = 同一次提交的重复点击 / 网络重试 → 视为成功（首次提交已入库并已通知）
    return NextResponse.json({ ok: true, message: '提交成功' });
  }

  // 窗口外 = 键已过期：用户是重新提交，换一把新键独立落库
  // （老记录保留 —— 它是一条真实的历史线索，不能被覆盖或删除）
  const nextKey = `${key.slice(0, 60)}#${Date.now().toString(36)}`;
  const { error: retryError } = await insertLead(sb, data, nextKey);

  if (retryError) {
    console.error('[lead:insert-retry-failed]', retryError);
    return NextResponse.json(
      { ok: false, message: '提交失败，请稍后重试或直接电话联系我们。' },
      { status: 500 },
    );
  }

  // 通知失败不回滚入库
  void notify(data);

  return NextResponse.json({ ok: true, message: '提交成功' });
}
