import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import AdminShell from '@/components/admin/AdminShell';
import NewsForm from '@/components/admin/NewsForm';

export const metadata: Metadata = {
  title: '新建社区内容 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** 社区内容复用新闻表单：preset 固定为「社区」，保存后跳回社区专区列表。 */
export default async function AdminCommunityNewPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>;
}) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  return (
    <AdminShell active="community" title="新建社区内容" desc="分类已预置为「社区」，保存后出现在「内容管理 → 社区专区」列表。">
      <NewsForm mode="create" presetCategory="社区" redirectTo="/admin/community" />
    </AdminShell>
  );
}
