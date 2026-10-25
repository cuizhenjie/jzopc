import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listMediaAssets } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
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
      desc="站点图片 / 视频等资源的登记表：封面、Logo 等表单可直接引用这里的 URL。"
      dbConfigured={isSupabaseConfigured()}
      actions={
        <Link
          href="/admin/media/new"
          className="rounded-lg bg-[var(--color-brand-navy)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-3)]"
        >
          + 登记资源
        </Link>
      }
    >
      <div className="mt-1">
        <MediaTable rows={rows} />
      </div>
    </AdminShell>
  );
}
