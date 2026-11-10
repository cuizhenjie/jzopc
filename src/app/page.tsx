import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { replicaMetadata } from '@/components/opc/ReplicaPage';
import ReferenceInteractions from '@/components/opc/ReferenceInteractions';
import { getRuntimeReplicaPage } from '@/lib/opc/blocks-runtime';

/**
 * 首页：页面外壳是参考站快照，两处动态区块由后台接管——
 *   hero 统计数字墙 ← site_stats（后台「统计数字」模块）
 *   社区动态四卡     ← news_posts（最新 4 条）
 * 后台保存后 revalidatePath('/') 立即失效，另有 ISR 300s 兜底。
 */
export const revalidate = 300;

export const metadata: Metadata = replicaMetadata('/');

export default async function HomePage() {
  const page = await getRuntimeReplicaPage('/');
  if (!page) notFound();
  return (
    <div className="opc-replica" data-opc-replica>
      <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
      <ReferenceInteractions route={page.path} />
    </div>
  );
}
