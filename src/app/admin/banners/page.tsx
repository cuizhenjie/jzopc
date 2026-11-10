import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listHomeBanners } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import HomeBannersManager from '@/components/admin/HomeBannersManager';

export const metadata: Metadata = {
  title: '首页 Banner · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminBannersPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const rows = await listHomeBanners();

  return (
    <AdminShell
      active="banners"
      title="首页 Banner"
      desc="首页首屏背景轮播。已发布的图按排序从小到大播放，底部步骤条和左右切换由前台自动生成。"
      dbConfigured={isSupabaseConfigured()}
    >
      <div className="mt-1">
        <HomeBannersManager rows={rows} />
      </div>
    </AdminShell>
  );
}
