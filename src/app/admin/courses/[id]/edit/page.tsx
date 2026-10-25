import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { getCourseById } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { courseFields, courseRowToValues } from '@/lib/admin/resource-configs';

export const metadata: Metadata = {
  title: '编辑课程 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCourseEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isInteger(courseId) || courseId <= 0) notFound();

  const row = await getCourseById(courseId);
  if (!row) notFound();

  return (
    <AdminShell active="courses" title="编辑课程" desc={`「${row.title}」的修改保存后立即在前台生效。`}>
      <ResourceForm
        mode="edit"
        fields={courseFields}
        apiBase="/api/admin/courses"
        pkValue={row.id}
        redirectTo="/admin/courses"
        editLabel="保存修改"
        initial={courseRowToValues(row)}
      />
    </AdminShell>
  );
}
