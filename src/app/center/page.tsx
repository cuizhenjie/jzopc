import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { replicaMetadata } from '@/components/opc/ReplicaPage';
import ReplicaInteractions from '@/components/opc/ReplicaInteractions';
import HashRouteBridge from '@/components/opc/HashRouteBridge';
import { getRuntimeReplicaPage } from '@/lib/opc/blocks-runtime';

/**
 * /center 的显式路由（优先于 catch-all）：课程方向卡由 blocks-runtime 注入
 * （courses 表 DB 优先、烘焙五卡兜底）；后台课程模块保存时 revalidatePath('/center')。
 * 其余页面内容仍为复刻快照。
 */
export const revalidate = 300;

export const metadata: Metadata = replicaMetadata('/center');

export default async function CenterPage() {
  const page = await getRuntimeReplicaPage('/center');
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
