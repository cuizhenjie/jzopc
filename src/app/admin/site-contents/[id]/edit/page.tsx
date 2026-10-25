import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { getSiteContentById } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { siteContentFields, siteContentRowToValues } from '@/lib/admin/resource-configs';

export const metadata: Metadata = {
  title: '编辑文案块 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminSiteContentEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const { id } = await params;
  const contentId = Number(id);
  if (!Number.isInteger(contentId) || contentId <= 0) notFound();

  const row = await getSiteContentById(contentId);
  if (!row) notFound();

  return (
    <AdminShell active="site-contents" title="编辑文案块" desc={`「${row.section}/${row.slug}」保存后立即生效。`}>
      <ResourceForm
        mode="edit"
        fields={siteContentFields}
        apiBase="/api/admin/site-contents"
        pkValue={row.id}
        redirectTo="/admin/site-contents"
        editLabel="保存修改"
        initial={siteContentRowToValues(row)}
      />
    </AdminShell>
  );
}
