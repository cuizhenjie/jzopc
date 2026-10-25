import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listAgents } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import { AgentsTable } from '@/components/admin/resource-tables';

export const metadata: Metadata = {
  title: '智能体工具 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminAgentsPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const rows = await listAgents();

  return (
    <AdminShell
      active="agents"
      title="智能体工具"
      desc="管理 /agents 前台目录：分类来自站点配置的智能体分类，发布后前台立即可见。"
      dbConfigured={isSupabaseConfigured()}
      actions={
        <Link
          href="/admin/agents/new"
          className="rounded-lg bg-[var(--color-brand-navy)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-brand-navy-3)]"
        >
          + 新建智能体
        </Link>
      }
    >
      <div className="mt-1">
        <AgentsTable rows={rows} />
      </div>
    </AdminShell>
  );
}
