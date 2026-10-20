import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { opsCookieName, tokenMatches } from '@/lib/ops/auth';
import LeadTable, { type LeadRow } from './LeadTable';

export const metadata: Metadata = {
  title: '线索看板',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const statusLabel: Record<string, string> = {
  new: '新建',
  contacting: '跟进中',
  converted: '已转化',
  invalid: '无效',
};

export default async function OpsLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(opsCookieName)?.value;

  if (!tokenMatches(token) && !tokenMatches(cookieToken)) {
    return (
      <div
        data-nav-theme="light"
        className="mx-auto flex min-h-[70vh] w-full max-w-[640px] flex-col items-center justify-center px-5 py-32 text-center"
      >
        <h1 className="text-[20px] font-semibold text-[var(--color-brand-navy)]">需要访问口令</h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
          该页面仅供社区内部运营使用。请在地址后追加
          <code className="mx-1 rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-[13px]">
            ?token=你的口令
          </code>
          访问。
        </p>
      </div>
    );
  }

  const sb = getSupabaseAdmin();
  let rows: LeadRow[] = [];

  if (sb) {
    const { data } = await sb
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    rows = (data ?? []) as unknown as LeadRow[];
  } else {
    // 未配置数据库：给出明确的空态而不是报错
    rows = [];
  }

  return (
    <div
      data-nav-theme="light"
      className="mx-auto w-full max-w-[1240px] px-5 py-28 sm:px-8 sm:py-32"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold text-[var(--color-brand-navy)]">线索看板</h1>
          <p className="mt-2 text-[13px] text-[var(--color-ink-2)]">
            共 {rows.length} 条线索。状态可更新，更改后立即生效。
          </p>
        </div>
        {!sb && (
          <span className="rounded-full bg-amber-50 px-3.5 py-1.5 text-[12px] font-medium text-amber-700 ring-1 ring-amber-200">
            未连接 Supabase · 展示空态
          </span>
        )}
      </div>

      <div className="mt-8">
        <LeadTable rows={rows} statusLabel={statusLabel} />
      </div>

      <p className="mt-8 text-[12px] leading-relaxed text-[var(--color-ink-3)]">
        安全说明：本页用环境变量 <code>OPS_TOKEN</code> 保护，数据库访问走服务端
        <code> service_role</code>，令牌不出现在任何日志。该方案弱于账号体系，二期将替换为 Supabase Auth
        + 角色表。
      </p>
    </div>
  );
}
