import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listMarketSubmissions } from '@/lib/admin/data';
import AdminShell from '@/components/admin/AdminShell';
import MarketSubmissionsActions from '@/components/admin/MarketSubmissionsActions';
import MarketSubmissionsTable from '@/components/admin/MarketSubmissionsTable';

export const metadata: Metadata = {
  title: '供需数据 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * 供需数据：/market 前台「发布需求 / 发布能力」两张表单的提交记录
 * （leads 表 lead_type='market'，按提交时间倒序）。
 * 2026-11-10 起由原 market_items 手工维护模式改为直读表单提交：
 * 用户填什么，这里就看到什么；跟进状态与备注在线索列表统一维护。
 */
export default async function AdminMarketPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const rows = await listMarketSubmissions();

  return (
    <AdminShell
      active="market"
      title="供需数据"
      dbConfigured={isSupabaseConfigured()}
      actions={<MarketSubmissionsActions />}
    >
      <div className="mt-1">
        <MarketSubmissionsTable rows={rows} />
      </div>
    </AdminShell>
  );
}
