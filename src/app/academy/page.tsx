import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { replicaMetadata } from '@/components/opc/ReplicaPage';
import ReferenceInteractions from '@/components/opc/ReferenceInteractions';
import { getRuntimeReplicaPage } from '@/lib/opc/blocks-runtime';

/**
 * 集智商学院：课程体系卡由后台 courses 表接管。
 * 后台保存后 revalidatePath('/academy') 立即失效，另有 ISR 300s 兜底。
 */
export const revalidate = 300;

export const metadata: Metadata = replicaMetadata('/academy');

export default async function AcademyPage() {
  const page = await getRuntimeReplicaPage('/academy');
  if (!page) notFound();
  return (
    <div className="opc-replica" data-opc-replica>
      <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
      <ReferenceInteractions route={page.path} />
    </div>
  );
}
