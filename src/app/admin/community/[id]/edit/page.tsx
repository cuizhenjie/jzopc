import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { getNewsById } from '@/lib/admin/data';
import AdminShell from '@/components/admin/AdminShell';
import NewsForm from '@/components/admin/NewsForm';

export const metadata: Metadata = {
  title: '编辑社区内容 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminCommunityEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const { id } = await params;
  const newsId = Number(id);
  if (!Number.isInteger(newsId) || newsId <= 0) notFound();

  const row = await getNewsById(newsId);
  if (!row) notFound();
  // 防串台：社区编辑入口只处理「社区」分类的记录
  if (row.category !== '社区') notFound();

  return (
    <AdminShell active="community" title="编辑社区内容" desc={`「${row.title}」的修改保存后立即在前台生效。`}>
      <NewsForm mode="edit" row={row} redirectTo="/admin/community" />
    </AdminShell>
  );
}
