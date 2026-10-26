import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { replicaMetadata } from '@/components/opc/ReplicaPage';
import ReplicaInteractions from '@/components/opc/ReplicaInteractions';
import HashRouteBridge from '@/components/opc/HashRouteBridge';
import { getRuntimeReplicaPage } from '@/lib/opc/blocks-runtime';

/**
 * /market 的显式路由（优先于 catch-all）：伙伴墙由 blocks-runtime 注入
 * （partners 表 DB 优先、烘焙 16 家兜底，与首页/工作页同一函数、同一口径）；
 * 供需列表卡仍为复刻快照（2026-10-26 方式一第一批范围仅伙伴墙）。
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
