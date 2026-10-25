import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { getEmpowerBySlug } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { empowerFields, empowerRowToValues } from '@/lib/admin/resource-configs';

export const metadata: Metadata = {
  title: '编辑赋能模块 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminEmpowerEditPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const { slug } = await params;
  const row = await getEmpowerBySlug(decodeURIComponent(slug));
  if (!row) notFound();

  return (
    <AdminShell active="empower" title="编辑赋能模块" desc={`「${row.title}」的修改保存后立即在前台生效。`}>
      <ResourceForm
        mode="edit"
        fields={empowerFields}
        apiBase="/api/admin/empower"
        pkValue={row.slug}
        redirectTo="/admin/empower"
        editLabel="保存修改"
        initial={empowerRowToValues(row)}
      />
    </AdminShell>
  );
}
