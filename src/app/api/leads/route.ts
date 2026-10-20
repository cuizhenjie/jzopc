import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { leadSchema, validateContact } from '@/lib/lead/schema';
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

  const { error } = await sb.from('leads').insert({
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
    idempotency_key: data.idempotencyKey || null,
  });

  if (error) {
    // 幂等键冲突 = 重复提交，视为成功
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, message: '提交成功' });
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
