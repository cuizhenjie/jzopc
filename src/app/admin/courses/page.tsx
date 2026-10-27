import type { Metadata } from 'next';
import { ActionLink } from '@/components/admin/templates/page-actions';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listCourses } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import { CoursesTable } from '@/components/admin/resource-tables';

export const metadata: Metadata = {
  title: '课程管理 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCoursesPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const rows = await listCourses();

  return (
    <AdminShell
      active="courses"
      title="课程管理"
      desc="管理 /academy 前台课程目录：按方向分组展示，发布后前台立即可见。"
      dbConfigured={isSupabaseConfigured()}
      actions={
        <ActionLink href="/admin/courses/new">+ 新建课程</ActionLink>
      }
    >
      <div className="mt-1">
        <CoursesTable rows={rows} />
      </div>
    </AdminShell>
  );
}
