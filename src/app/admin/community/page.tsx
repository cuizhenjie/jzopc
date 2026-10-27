import type { Metadata } from 'next';
import { ActionLink } from '@/components/admin/templates/page-actions';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listNews } from '@/lib/admin/data';
import AdminShell from '@/components/admin/AdminShell';
import NewsTable from '@/components/admin/NewsTable';
import NewsStatusTabs from '@/components/admin/NewsStatusTabs';

export const metadata: Metadata = {
  title: '社区专区 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** 社区专区与新闻/活动共用 news_posts 表，这里只显示分类为「社区」的记录。 */
const COMMUNITY_CATEGORY = '社区';

export default async function AdminCommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const { status } = await searchParams;
  const rows = (await listNews(status)).filter((n) => n.category === COMMUNITY_CATEGORY);

  return (
    <AdminShell
      active="community"
      title="社区专区"
      desc={`与新闻资讯共用同一内容池，这里只显示分类为「${COMMUNITY_CATEGORY}」的记录。`}
      dbConfigured={isSupabaseConfigured()}
      actions={
        <ActionLink href={`/admin/community/new?preset=${encodeURIComponent(COMMUNITY_CATEGORY)}`}>
          + 新建社区内容
        </ActionLink>
      }
    >
      <NewsStatusTabs basePath="/admin/community" status={status} />

      <div className="mt-5">
        <NewsTable
          rows={rows}
          createHref={`/admin/community/new?preset=${encodeURIComponent(COMMUNITY_CATEGORY)}`}
          emptyTitle="该状态下暂无社区内容"
          emptyCta="发布第一条社区内容"
        />
      </div>
    </AdminShell>
  );
}
