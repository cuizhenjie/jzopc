import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { siteContentFields } from '@/lib/admin/resource-configs';

export const metadata: Metadata = {
  title: '新建文案块 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminSiteContentNewPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  return (
    <AdminShell active="site-contents" title="新建文案块" desc="同区块（section）下标识（slug）需唯一。">
      <ResourceForm
        mode="create"
        fields={siteContentFields}
        apiBase="/api/admin/site-contents"
        redirectTo="/admin/site-contents"
        initial={{
          section: '',
          slug: '',
          title: '',
          subtitle: '',
          body_md: '',
          meta_json: '',
          sort_order: 0,
          published: false,
        }}
      />
    </AdminShell>
  );
}
