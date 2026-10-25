import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { mediaFields } from '@/lib/admin/resource-configs';

export const metadata: Metadata = {
  title: '登记资源 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminMediaNewPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  return (
    <AdminShell active="media" title="登记资源" desc="把站内静态资源或外链资源的 URL 登记入媒体库，便于各表单引用与统一管理。">
      <ResourceForm
        mode="create"
        fields={mediaFields}
        apiBase="/api/admin/media"
        redirectTo="/admin/media"
        createLabel="登记"
        initial={{
          path: '',
          url: '',
          kind: 'image',
          alt: '',
          size_bytes: 0,
        }}
      />
    </AdminShell>
  );
}
