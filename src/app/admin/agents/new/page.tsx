import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { agentFields } from '@/lib/admin/resource-configs';

export const metadata: Metadata = {
  title: '新建智能体 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminAgentNewPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  return (
    <AdminShell active="agents" title="新建智能体" desc="保存后出现在前台智能体目录。">
      <ResourceForm
        mode="create"
        fields={agentFields}
        apiBase="/api/admin/agents"
        redirectTo="/admin/agents"
        initial={{
          name: '',
          slug: '',
          category: agentFields.find((f) => f.name === 'category')?.options?.[0]?.value ?? '',
          summary: '',
          description: '',
          external_url: '',
          provider: '',
          icon_url: '',
          cover_url: '',
          tags: [],
          sort_order: 0,
          featured: false,
          published: false,
        }}
      />
    </AdminShell>
  );
}
