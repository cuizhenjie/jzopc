import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { marketFields } from '@/lib/admin/resource-configs';

export const metadata: Metadata = {
  title: '新建供需 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminMarketNewPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  return (
    <AdminShell active="market" title="新建供需" desc="保存后出现在前台供需市场。">
      <ResourceForm
        mode="create"
        fields={marketFields}
        apiBase="/api/admin/market"
        redirectTo="/admin/market"
        createLabel="发布"
        initial={{
          title: '',
          slug: '',
          type: 'demand',
          category: '',
          summary: '',
          bodyHtml: '',
          org_name: '',
          contact_hint: '',
          tags: [],
          status: 'open',
          published_at: '',
          published: false,
        }}
      />
    </AdminShell>
  );
}
