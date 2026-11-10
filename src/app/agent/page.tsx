import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { replicaMetadata } from '@/components/opc/ReplicaPage';
import ReferenceInteractions from '@/components/opc/ReferenceInteractions';
import { getRuntimeReplicaPage } from '@/lib/opc/blocks-runtime';

/**
 * 智能体：目录（分类 chips + 结果网格）由后台 agents 表接管。
 * 后台保存后 revalidatePath('/agent') 立即失效，另有 ISR 300s 兜底。
 */
export const revalidate = 300;

export const metadata: Metadata = replicaMetadata('/agent');

export default async function AgentPage() {
  const page = await getRuntimeReplicaPage('/agent');
  if (!page) notFound();
  return (
    <div className="opc-replica" data-opc-replica>
      <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
      <ReferenceInteractions route={page.path} />
    </div>
  );
}
