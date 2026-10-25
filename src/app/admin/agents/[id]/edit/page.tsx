import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { getAgentById } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { agentFields, agentRowToValues } from '@/lib/admin/resource-configs';

export const metadata: Metadata = {
  title: '编辑智能体 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminAgentEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const { id } = await params;
  const agentId = Number(id);
  if (!Number.isInteger(agentId) || agentId <= 0) notFound();

  const row = await getAgentById(agentId);
  if (!row) notFound();

  return (
    <AdminShell active="agents" title="编辑智能体" desc={`「${row.name}」的修改保存后立即在前台生效。`}>
      <ResourceForm
        mode="edit"
        fields={agentFields}
        apiBase="/api/admin/agents"
        pkValue={row.id}
        redirectTo="/admin/agents"
        initial={agentRowToValues(row)}
      />
    </AdminShell>
  );
}
