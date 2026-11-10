import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReplicaPage, { replicaMetadata } from '@/components/opc/ReplicaPage';

/** 大健康+AI 页面
 *
 * 页面主体是参考站快照（scripts/opc-reference → generated/pages.json），
 * 由 scripts/build-opc-reference.mjs 编译产出。
 */
export const metadata: Metadata = replicaMetadata('/health');

export default function healthPage() {
  return <ReplicaPage pathname="/health" />;
}
