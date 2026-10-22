import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import {
  leadStats,
  leadStatusLabels,
  leadTypeLabels,
  listLeads,
  listNews,
  newsStats,
} from '@/lib/admin/data';
import { newsStatusLabels } from '@/lib/admin/news-schema';
import AdminShell from '@/components/admin/AdminShell';

export const metadata: Metadata = {
  title: '概览 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('zh-CN', { hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function StatCard({ label, value, hint, href }: { label: string; value: number | string; hint?: string; href?: string }) {
  const inner = (
    <>
      <p className="text-[12px] font-medium text-[var(--color-ink-3)]">{label}</p>
      <p className="mt-2 text-[28px] font-semibold leading-none text-[var(--color-brand-navy)]">{value}</p>
      {hint && <p className="mt-2 text-[12px] text-[var(--color-ink-3)]">{hint}</p>}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="block rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[var(--color-brand-blue-deep)]/30"
    >
      {inner}
    </Link>
  ) : (
    <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-card)]">{inner}</div>
  );
}

export default async function AdminOverviewPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const db = isSupabaseConfigured();
  const [leads, stats, news, nStats] = await Promise.all([
    listLeads({ page: 1 }),
    leadStats(),
    listNews(),
    newsStats(),
  ]);

  return (
    <AdminShell
      active="overview"
      title="概览"
      desc="留资线索与社区动态的总体情况。"
      dbConfigured={db}
    >
      <section aria-label="线索概况">
        <h2 className="text-[15px] font-semibold text-[var(--color-brand-navy)]">留资线索</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="线索总数" value={stats.total} href="/admin/leads" />
          <StatCard label="近 7 天新增" value={stats.recent7d} href="/admin/leads" />
          <StatCard
            label="待跟进（新建）"
            value={stats.byStatus.new ?? 0}
            hint="状态为「新建」的线索"
            href="/admin/leads?status=new"
          />
          <StatCard
            label="跟进中"
            value={stats.byStatus.contacting ?? 0}
            href="/admin/leads?status=contacting"
          />
        </div>
      </section>

      <section aria-label="动态概况" className="mt-10">
        <h2 className="text-[15px] font-semibold text-[var(--color-brand-navy)]">社区动态</h2>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="全部动态" value={Object.values(nStats).reduce((a, b) => a + b, 0)} href="/admin/news" />
          <StatCard label="已发布" value={nStats.published ?? 0} href="/admin/news?status=published" />
          <StatCard label="草稿" value={nStats.draft ?? 0} href="/admin/news?status=draft" />
          <StatCard
            label="已转化 / 无效"
            value={`${stats.byStatus.converted ?? 0} / ${stats.byStatus.invalid ?? 0}`}
            hint="线索最终状态"
          />
        </div>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section aria-label="最新线索" className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[var(--color-brand-navy)]">最新线索</h2>
            <Link href="/admin/leads" className="text-[13px] font-medium text-[var(--color-brand-blue-deep)] hover:underline">
              全部 →
            </Link>
          </div>
          {leads.rows.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] px-4 py-8 text-center text-[13px] text-[var(--color-ink-3)]">
              还没有线索提交。
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--color-line)]">
              {leads.rows.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-[var(--color-ink)]">
                      {r.name}
                      <span className="ml-2 text-[11px] font-normal text-[var(--color-ink-3)]">
                        {leadTypeLabels[r.lead_type] ?? r.lead_type}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-[var(--color-ink-3)]">
                      {r.contact} · {fmtDate(r.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink-2)]">
                    {leadStatusLabels[r.status] ?? r.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="最新动态" className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[var(--color-brand-navy)]">最新动态</h2>
            <Link href="/admin/news" className="text-[13px] font-medium text-[var(--color-brand-blue-deep)] hover:underline">
              全部 →
            </Link>
          </div>
          {news.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-[var(--color-line)] px-4 py-8 text-center text-[13px] text-[var(--color-ink-3)]">
              还没有动态，<Link href="/admin/news/new" className="text-[var(--color-brand-blue-deep)] hover:underline">去发布第一篇</Link>。
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--color-line)]">
              {news.slice(0, 5).map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/admin/news/${n.id}/edit`} className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[var(--color-ink)] hover:text-[var(--color-brand-blue-deep)]">
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--color-ink-3)]">
                      {n.category} · {fmtDate(n.published_at)}
                    </p>
                  </Link>
                  <span className="shrink-0 rounded bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink-2)]">
                    {newsStatusLabels[n.status as keyof typeof newsStatusLabels] ?? n.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
