import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import {
  LEAD_STATUSES,
  LEAD_TYPES,
  leadStatusLabels,
  leadTypeLabels,
  listLeads,
} from '@/lib/admin/data';
import AdminShell from '@/components/admin/AdminShell';
import LeadsTable from '@/components/admin/LeadsTable';

export const metadata: Metadata = {
  title: '线索管理 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

type SearchParams = { status?: string; type?: string; q?: string; page?: string };

function pageHref(params: SearchParams, page: number): string {
  const sp = new URLSearchParams();
  if (params.status) sp.set('status', params.status);
  if (params.type) sp.set('type', params.type);
  if (params.q) sp.set('q', params.q);
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return qs ? `/admin/leads?${qs}` : '/admin/leads';
}

const selectClass =
  'rounded-lg border border-[var(--color-line)] bg-white px-3 py-2 text-[13px] text-[var(--color-ink-2)] outline-none focus:border-[var(--color-brand-blue)]';

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const result = await listLeads({
    status: params.status,
    type: params.type,
    q: params.q?.trim() || undefined,
    page,
  });

  const exportQs = new URLSearchParams();
  if (params.status) exportQs.set('status', params.status);
  if (params.type) exportQs.set('type', params.type);
  if (params.q) exportQs.set('q', params.q);
  const exportHref = `/api/admin/leads/export${exportQs.toString() ? `?${exportQs}` : ''}`;

  return (
    <AdminShell
      active="leads"
      title="线索管理"
      desc={`共 ${result.total} 条线索。状态与备注的修改立即生效。`}
      dbConfigured={isSupabaseConfigured()}
      actions={
        <a
          href={exportHref}
          className="rounded-lg bg-white px-4 py-2 text-[13px] font-medium text-[var(--color-brand-navy)] ring-1 ring-[var(--color-line)] transition-colors hover:bg-[var(--color-surface-2)]"
        >
          导出 CSV（当前筛选）
        </a>
      }
    >
      {/* 筛选：原生 GET 表单，无 JS 也能用 */}
      <form
        method="get"
        action="/admin/leads"
        className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-[var(--color-line)] bg-white p-4 shadow-[var(--shadow-card)]"
      >
        <select name="status" defaultValue={params.status ?? ''} aria-label="按状态筛选" className={selectClass}>
          <option value="">全部状态</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {leadStatusLabels[s]}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={params.type ?? ''} aria-label="按类型筛选" className={selectClass}>
          <option value="">全部类型</option>
          {LEAD_TYPES.map((t) => (
            <option key={t} value={t}>
              {leadTypeLabels[t]}
            </option>
          ))}
        </select>
        <input
          type="text"
          name="q"
          defaultValue={params.q ?? ''}
          placeholder="搜索姓名 / 联系方式 / 公司"
          aria-label="关键词搜索"
          className={`${selectClass} min-w-[220px] flex-1`}
        />
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-brand-navy)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-3)]"
        >
          筛选
        </button>
        {(params.status || params.type || params.q) && (
          <Link
            href="/admin/leads"
            className="rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-brand-navy)]"
          >
            重置
          </Link>
        )}
      </form>

      <div className="mt-5">
        <LeadsTable rows={result.rows} />
      </div>

      {result.pageCount > 1 && (
        <nav aria-label="分页" className="mt-6 flex items-center justify-between">
          {result.page > 1 ? (
            <Link
              href={pageHref(params, result.page - 1)}
              className="rounded-lg bg-white px-4 py-2 text-[13px] font-medium text-[var(--color-brand-navy)] ring-1 ring-[var(--color-line)] transition-colors hover:bg-[var(--color-surface-2)]"
            >
              ← 上一页
            </Link>
          ) : (
            <span />
          )}
          <span className="text-[13px] text-[var(--color-ink-3)]">
            第 {result.page} / {result.pageCount} 页
          </span>
          {result.page < result.pageCount ? (
            <Link
              href={pageHref(params, result.page + 1)}
              className="rounded-lg bg-white px-4 py-2 text-[13px] font-medium text-[var(--color-brand-navy)] ring-1 ring-[var(--color-line)] transition-colors hover:bg-[var(--color-surface-2)]"
            >
              下一页 →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </AdminShell>
  );
}
