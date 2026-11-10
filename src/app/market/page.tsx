import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { replicaMetadata } from '@/components/opc/ReplicaPage';
import ReferenceInteractions from '@/components/opc/ReferenceInteractions';
import { getRuntimeReplicaPage } from '@/lib/opc/blocks-runtime';

/**
 * 供需发布：页面外壳是参考站快照，「社区供需榜」由后台 market_items 表接管
 * （供给 / 需求两列各自替换）。发布表单提交后进入后台线索池。
 */
export const revalidate = 300;

export const metadata: Metadata = replicaMetadata('/market');

export default async function MarketPage() {
  const page = await getRuntimeReplicaPage('/market');
  if (!page) notFound();
  return (
    <div className="opc-replica" data-opc-replica>
      <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
      <ReferenceInteractions route={page.path} />
    </div>
  );
}
