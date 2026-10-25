import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { courseFields } from '@/lib/admin/resource-configs';

export const metadata: Metadata = {
  title: '新建课程 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCourseNewPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  return (
    <AdminShell active="courses" title="新建课程" desc="保存后出现在前台商学院课程目录。">
      <ResourceForm
        mode="create"
        fields={courseFields}
        apiBase="/api/admin/courses"
        redirectTo="/admin/courses"
        createLabel="上架"
        initial={{
          title: '',
          slug: '',
          track: '',
          mentor: '',
          summary: '',
          bodyHtml: '',
          cover_url: '',
          tags: [],
          sort_order: 0,
          published: false,
        }}
      />
    </AdminShell>
  );
}
