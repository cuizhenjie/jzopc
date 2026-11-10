import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '@/lib/admin/auth';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { NEWS_CATEGORIES } from '@/lib/admin/news-schema';
import AdminShell from '@/components/admin/AdminShell';
import NewsForm from '@/components/admin/NewsForm';

export const metadata: Metadata = {
  title: '新建动态 · 管理后台',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AdminNewsNewPage({
  searchParams,
}: {
  /** preset：预置分类（例如从分类筛选入口带过来的「活动」），非法值忽略。 */
  searchParams: Promise<{ preset?: string }>;
}) {
  if (!(await isAdminAuthed())) redirect('/admin/login');

  const { preset } = await searchParams;
  const presetCategory =
    preset && (NEWS_CATEGORIES as readonly string[]).includes(preset) ? preset : undefined;

  return (
    <AdminShell
      active="news"
      title="新建动态"
      desc="状态选「已发布」保存后立即在前台可见；选「草稿」则仅后台可见。"
      dbConfigured={isSupabaseConfigured()}
    >
      <NewsForm mode="create" presetCategory={presetCategory} redirectTo="/admin/news" />
    </AdminShell>
  );
}
