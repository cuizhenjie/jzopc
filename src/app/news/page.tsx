import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { replicaMetadata } from '@/components/opc/ReplicaPage';
import ReferenceInteractions from '@/components/opc/ReferenceInteractions';
import { getReplicaListPage } from '@/lib/opc/news-runtime';

/**
 * 社区动态：列表卡由后台 news_posts 渲染（DB 唯一事实源，空库 = 空列表）。
 * 后台发布后 revalidatePath('/news') 立即失效，另有 ISR 300s 兜底。
 */
export const revalidate = 300;

export const metadata: Metadata = replicaMetadata('/news');

export default async function NewsPage() {
  const page = await getReplicaListPage('/news');
  if (!page) notFound();
  return (
    <div className="opc-replica" data-opc-replica>
      <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
      <ReferenceInteractions route={page.path} />
    </div>
  );
}
