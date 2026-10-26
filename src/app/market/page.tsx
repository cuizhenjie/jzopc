import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { replicaMetadata } from '@/components/opc/ReplicaPage';
import ReplicaInteractions from '@/components/opc/ReplicaInteractions';
import HashRouteBridge from '@/components/opc/HashRouteBridge';
import { getRuntimeReplicaPage } from '@/lib/opc/blocks-runtime';

/**
 * /market 的显式路由（优先于 catch-all）：blocks-runtime 注入两个动态区块——
 * 伙伴墙（partners 表）与供需卡（market_items 表，供给/需求分区各自 DB 优先、烘焙兜底）。
 */
export const revalidate = 300;

export const metadata: Metadata = replicaMetadata('/market');

export default async function MarketPage() {
  const page = await getRuntimeReplicaPage('/market');
  if (!page) notFound();
  return (
    <>
      <link rel="stylesheet" href="/opc/reference-blue.css" precedence="opc-reference" />
      <div className="opc-replica opc-replica" data-opc-replica>
        <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
        <ReplicaInteractions key={page.path} route={page.path} />
        <HashRouteBridge />
      </div>
    </>
  );
}
