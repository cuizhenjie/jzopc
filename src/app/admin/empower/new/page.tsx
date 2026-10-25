import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { empowerFields } from '@/lib/admin/resource-configs';

export const metadata: Metadata = {
  title: '新建赋能模块 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminEmpowerNewPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  return (
    <AdminShell active="empower" title="新建赋能模块" desc="Slug 即前台路由 /empower/<slug>，创建后不可改。">
      <ResourceForm
        mode="create"
        fields={empowerFields}
        apiBase="/api/admin/empower"
        redirectTo="/admin/empower"
        initial={{
          index_no: '',
          slug: '',
          title: '',
          tagline: '',
          hero_desc: '',
          body_md: '',
          values_json: '',
          items_json: '',
          highlights_json: '',
          lead_type: '',
          sort_order: 0,
          published: false,
        }}
      />
    </AdminShell>
  );
}
