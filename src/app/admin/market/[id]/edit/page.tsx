import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { getMarketItemById } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { marketFields, marketRowToValues } from '@/lib/admin/resource-configs';

export const metadata: Metadata = {
  title: '编辑供需 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminMarketEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) notFound();

  const row = await getMarketItemById(itemId);
  if (!row) notFound();

  return (
    <AdminShell active="market" title="编辑供需" desc={`「${row.title}」的修改保存后立即在前台生效。`}>
      <ResourceForm
        mode="edit"
        fields={marketFields}
        apiBase="/api/admin/market"
        pkValue={row.id}
        redirectTo="/admin/market"
        editLabel="保存修改"
        initial={marketRowToValues(row)}
      />
    </AdminShell>
  );
}
