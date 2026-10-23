import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listNews } from '@/lib/admin/data';
import AdminShell from '@/components/admin/AdminShell';
import NewsTable from '@/components/admin/NewsTable';
import NewsStatusTabs from '@/components/admin/NewsStatusTabs';

export const metadata: Metadata = {
  title: '活动管理 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** 活动与新闻共用 news_posts 表，按分类「活动」切出活动列表。 */
const ACTIVITY_CATEGORY = '活动';

export default async function AdminActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const { status } = await searchParams;
  const rows = (await listNews(status)).filter((n) => n.category === ACTIVITY_CATEGORY);

  return (
    <AdminShell
      active="activities"
      title="活动管理"
      desc={`与新闻资讯共用同一内容池，这里只显示分类为「${ACTIVITY_CATEGORY}」的记录。`}
      dbConfigured={isSupabaseConfigured()}
      actions={
        <Link
          href={`/admin/news/new?preset=${encodeURIComponent(ACTIVITY_CATEGORY)}`}
          className="rounded-lg bg-[var(--color-brand-navy)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-3)]"
        >
          + 新建活动
        </Link>
      }
    >
      <NewsStatusTabs basePath="/admin/activities" status={status} />

      <div className="mt-5">
        <NewsTable
          rows={rows}
          createHref={`/admin/news/new?preset=${encodeURIComponent(ACTIVITY_CATEGORY)}`}
          emptyTitle="该状态下暂无活动"
          emptyCta="发布第一个活动"
        />
      </div>
    </AdminShell>
  );
}
