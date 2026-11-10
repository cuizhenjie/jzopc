import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { replicaMetadata } from '@/components/opc/ReplicaPage';
import ReferenceInteractions from '@/components/opc/ReferenceInteractions';
import { getReplicaPage } from '@/lib/opc/content';

/**
 * 申请入驻：页面外壳是参考站快照（入驻意向表 / 入驻要求 / 权益 / 六步流程）。
 * 表单提交由 ReferenceInteractions 直连 /api/leads，线索进入后台「线索」模块。
 */
export const metadata: Metadata = replicaMetadata('/apply');

export default function ApplyPage() {
  const page = getReplicaPage('/apply');
  if (!page) notFound();
  return (
    <div className="opc-replica" data-opc-replica>
      <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
      <ReferenceInteractions route={page.path} />
    </div>
  );
}
