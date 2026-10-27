import type { Metadata } from 'next';
import { ActionLink } from '@/components/admin/templates/page-actions';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listMarketItems } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import { MarketTable } from '@/components/admin/resource-tables';

export const metadata: Metadata = {
  title: '供需市场 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminMarketPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const rows = await listMarketItems();

  return (
    <AdminShell
      active="market"
      title="供需市场"
      desc="管理 /market 前台的供需信息：需求与供给两类，发布后前台立即可见。"
      dbConfigured={isSupabaseConfigured()}
      actions={
        <ActionLink href="/admin/market/new">+ 新建供需</ActionLink>
      }
    >
      <div className="mt-1">
        <MarketTable rows={rows} />
      </div>
    </AdminShell>
  );
}
