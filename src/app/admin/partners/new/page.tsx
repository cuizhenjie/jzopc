import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { partnerFields } from '@/lib/admin/resource-configs';

export const metadata: Metadata = {
  title: '新建合作伙伴 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminPartnerNewPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  return (
    <AdminShell active="partners" title="新建合作伙伴" desc="保存后出现在前台合作伙伴墙。">
      <ResourceForm
        mode="create"
        fields={partnerFields}
        apiBase="/api/admin/partners"
        redirectTo="/admin/partners"
        initial={{
          name: '',
          group_name: '',
          logo_url: '',
          website: '',
          sort_order: 0,
          published: false,
        }}
      />
    </AdminShell>
  );
}
