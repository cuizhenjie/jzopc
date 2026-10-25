import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listSiteStats } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import SiteStatsManager from '@/components/admin/SiteStatsManager';

export const metadata: Metadata = {
  title: '统计数字 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminSiteStatsPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const rows = await listSiteStats();

  return (
    <AdminShell
      active="site-stats"
      title="统计数字"
      desc="首页数字墙的数据源：行内直接编辑，保存后首页立即生效。"
      dbConfigured={isSupabaseConfigured()}
    >
      <div className="mt-1">
        <SiteStatsManager rows={rows} />
      </div>
    </AdminShell>
  );
}
