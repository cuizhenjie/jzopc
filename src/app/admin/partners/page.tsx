import type { Metadata } from 'next';
import { ActionLink } from '@/components/admin/templates/page-actions';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listPartners } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import { PartnersTable } from '@/components/admin/resource-tables';

export const metadata: Metadata = {
  title: '合作伙伴 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminPartnersPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const rows = await listPartners();

  return (
    <AdminShell
      active="partners"
      title="合作伙伴"
      desc="管理首页与合作页展示的合作伙伴：按分组与排序展示 Logo，发布后前台立即可见。"
      dbConfigured={isSupabaseConfigured()}
      actions={
        <ActionLink href="/admin/partners/new">+ 新建合作伙伴</ActionLink>
      }
    >
      <div className="mt-1">
        <PartnersTable rows={rows} />
      </div>
    </AdminShell>
  );
}
