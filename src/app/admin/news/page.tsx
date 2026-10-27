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
  title: '新闻动态 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

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
      title="新闻资讯"
      desc="发布、编辑与下架社区动态。已发布的改动立即在前台生效。"
      dbConfigured={isSupabaseConfigured()}
      actions={
        <ActionLink href="/admin/news/new">+ 新建动态</ActionLink>
      }
    >
      <NewsStatusTabs basePath="/admin/news" status={status} />

      <div className="mt-5">
        <NewsTable rows={rows} />
      </div>
    </AdminShell>
  );
}
