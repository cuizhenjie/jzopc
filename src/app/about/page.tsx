import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { replicaMetadata } from '@/components/opc/ReplicaPage';
import ReferenceInteractions from '@/components/opc/ReferenceInteractions';
import { getRuntimeReplicaPage } from '@/lib/opc/blocks-runtime';

/**
 * 关于集智：页面外壳是参考站快照，「生态伙伴」墙由后台 partners 表接管。
 * 后台保存后 revalidatePath('/about') 立即失效，另有 ISR 300s 兜底。
 */
export const revalidate = 300;

export const metadata: Metadata = replicaMetadata('/about');

export default async function AboutPage() {
  const page = await getRuntimeReplicaPage('/about');
  if (!page) notFound();
  return (
    <div className="opc-replica" data-opc-replica>
      <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
      <ReferenceInteractions route={page.path} />
    </div>
  );
}
