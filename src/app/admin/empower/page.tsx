import type { Metadata } from 'next';
import { ActionLink } from '@/components/admin/templates/page-actions';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listEmpowerModules } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import { EmpowerTable } from '@/components/admin/resource-tables';

export const metadata: Metadata = {
  title: '八大赋能 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminEmpowerPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const rows = await listEmpowerModules();

  return (
    <AdminShell
      active="empower"
      title="八大赋能"
      desc="管理 /empower/<slug> 赋能模块页：已发布的模块在库内不存在时回落站点内置内容。"
      dbConfigured={isSupabaseConfigured()}
      actions={
        <ActionLink href="/admin/empower/new">+ 新建赋能模块</ActionLink>
      }
    >
      <div className="mt-1">
        <EmpowerTable rows={rows} />
      </div>
    </AdminShell>
  );
}
