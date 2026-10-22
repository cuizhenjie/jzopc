import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import AdminShell from '@/components/admin/AdminShell';
import NewsForm from '@/components/admin/NewsForm';

export const metadata: Metadata = {
  title: '新建动态 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminNewsNewPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  return (
    <AdminShell
      active="news"
      title="新建动态"
      desc="状态选「已发布」保存后立即在前台可见；选「草稿」则仅后台可见。"
      dbConfigured={isSupabaseConfigured()}
    >
      <NewsForm mode="create" />
    </AdminShell>
  );
}
