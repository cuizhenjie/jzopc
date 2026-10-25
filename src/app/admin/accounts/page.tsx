import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed, getAdminSession } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { listAdminAccounts } from '@/lib/admin/resource-data';
import AdminShell from '@/components/admin/AdminShell';
import AccountsManager from '@/components/admin/AccountsManager';

export const metadata: Metadata = {
  title: '管理员账号 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminAccountsPage() {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const session = await getAdminSession();
  const rows = await listAdminAccounts();

  return (
    <AdminShell
      active="accounts"
      title="管理员账号"
      desc="后台登录账号的新建、启停与密码重置。密码仅存 scrypt 哈希，任何人都无法查看。"
      dbConfigured={isSupabaseConfigured()}
    >
      <div className="mt-1">
        <AccountsManager rows={rows} currentUid={session?.uid ?? null} />
      </div>
    </AdminShell>
  );
}
