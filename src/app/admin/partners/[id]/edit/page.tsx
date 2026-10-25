import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { getPartnerById } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { partnerFields, partnerRowToValues } from '@/lib/admin/resource-configs';

export const metadata: Metadata = {
  title: '编辑合作伙伴 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminPartnerEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const { id } = await params;
  const partnerId = Number(id);
  if (!Number.isInteger(partnerId) || partnerId <= 0) notFound();

  const row = await getPartnerById(partnerId);
  if (!row) notFound();

  return (
    <AdminShell active="partners" title="编辑合作伙伴" desc={`「${row.name}」的修改保存后立即在前台生效。`}>
      <ResourceForm
        mode="edit"
        fields={partnerFields}
        apiBase="/api/admin/partners"
        pkValue={row.id}
        redirectTo="/admin/partners"
        editLabel="保存修改"
        initial={partnerRowToValues(row)}
      />
    </AdminShell>
  );
}
