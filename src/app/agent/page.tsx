import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { replicaMetadata } from '@/components/opc/ReplicaPage';
import ReplicaInteractions from '@/components/opc/ReplicaInteractions';
import HashRouteBridge from '@/components/opc/HashRouteBridge';
import { getRuntimeReplicaPage } from '@/lib/opc/blocks-runtime';

/**
 * /agent 的显式路由（优先于 catch-all）：智能体目录由 blocks-runtime 注入
 * （agents 表 DB 优先——分类 chips 与分区整体重建，烘焙 233 卡兜底）；
 * 后台智能体模块保存时 revalidatePath('/agent')。
 */
export const revalidate = 300;

export const metadata: Metadata = replicaMetadata('/agent');

export default async function AgentPage() {
  const page = await getRuntimeReplicaPage('/agent');
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
