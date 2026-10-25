import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import AdminShell from '@/components/admin/AdminShell';
import ResourceForm from '@/components/admin/crud/ResourceForm';
import { mediaFields, mediaRowToValues } from '@/lib/admin/resource-configs';
import type { AdminMediaRow } from '@/lib/admin/resources';

export const metadata: Metadata = {
  title: '编辑资源 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminMediaEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const { id } = await params;
  const mediaId = Number(id);
  if (!Number.isInteger(mediaId) || mediaId <= 0) notFound();

  const sb = getSupabaseAdmin();
  const { data } = sb
    ? await sb.from('media_assets').select('*').eq('id', mediaId).maybeSingle()
    : { data: null };
  if (!data) notFound();
  const row = data as AdminMediaRow;

  return (
    <AdminShell active="media" title="编辑资源" desc={`「${row.path}」的登记信息修改。`}>
      <ResourceForm
        mode="edit"
        fields={mediaFields}
        apiBase="/api/admin/media"
        pkValue={row.id}
        redirectTo="/admin/media"
        editLabel="保存修改"
        initial={mediaRowToValues(row)}
      />
    </AdminShell>
  );
}
