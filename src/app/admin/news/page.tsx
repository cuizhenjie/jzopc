import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listNews } from '@/lib/admin/data';
import AdminShell from '@/components/admin/AdminShell';
import NewsTable from '@/components/admin/NewsTable';

export const metadata: Metadata = {
  title: '新闻动态 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'published', label: '已发布' },
  { value: 'draft', label: '草稿' },
  { value: 'archived', label: '已下架' },
] as const;

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const { status } = await searchParams;
  const rows = await listNews(status);

  return (
    <AdminShell
      active="news"
      title="新闻动态"
      desc="发布、编辑与下架社区动态。已发布的改动立即在前台生效。"
      dbConfigured={isSupabaseConfigured()}
      actions={
        <Link
          href="/admin/news/new"
          className="rounded-lg bg-[var(--color-brand-navy)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-3)]"
        >
          + 新建动态
        </Link>
      }
    >
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const active = (status ?? '') === tab.value;
          const href = tab.value ? `/admin/news?status=${tab.value}` : '/admin/news';
          return (
            <Link
              key={tab.label}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'rounded-full bg-[var(--color-brand-navy)] px-4 py-1.5 text-[13px] font-medium text-white'
                  : 'rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-[var(--color-ink-2)] ring-1 ring-[var(--color-line)] transition-colors hover:text-[var(--color-brand-navy)]'
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-5">
        <NewsTable rows={rows} />
      </div>
    </AdminShell>
  );
}
