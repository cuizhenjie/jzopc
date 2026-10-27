import type { Metadata } from 'next';
import { ActionLink } from '@/components/admin/templates/page-actions';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listMediaAssets } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import MediaUploader from '@/components/admin/MediaUploader';
import { MediaTable } from '@/components/admin/resource-tables';

export const metadata: Metadata = {
  title: '媒体库 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminMediaPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const rows = await listMediaAssets();

  return (
    <AdminShell
      active="media"
      title="媒体库"
      desc="上传图片直入对象存储（Supabase Storage），或登记站外资源 URL；封面、Logo、正文配图可直接引用这里的地址。"
      dbConfigured={isSupabaseConfigured()}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <MediaUploader />
          <ActionLink href="/admin/media/new">+ 登记资源</ActionLink>
        </div>
      }
    >
      <div className="mt-1">
        <MediaTable rows={rows} />
      </div>
    </AdminShell>
  );
}
