import type { Metadata } from 'next';
import { ActionLink } from '@/components/admin/templates/page-actions';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listSiteContents } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import { SiteContentsTable } from '@/components/admin/resource-tables';

export const metadata: Metadata = {
  title: '页面文案 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminSiteContentsPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const rows = await listSiteContents();

  return (
    <AdminShell
      active="site-contents"
      title="页面文案"
      desc="站点各页面文案块（section + slug 定位）：标题 / 副标题 / 正文与扩展字段，按 section 分组管理。"
      dbConfigured={isSupabaseConfigured()}
      actions={
        <ActionLink href="/admin/site-contents/new">+ 新建文案块</ActionLink>
      }
    >
      <div className="mt-1">
        <SiteContentsTable rows={rows} />
      </div>
    </AdminShell>
  );
}
