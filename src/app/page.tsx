import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { replicaMetadata } from '@/components/opc/ReplicaPage';
import ReplicaInteractions from '@/components/opc/ReplicaInteractions';
import HashRouteBridge from '@/components/opc/HashRouteBridge';
import { getRuntimeReplicaPage } from '@/lib/opc/blocks-runtime';

/**
 * 首页显式路由：运行时化区块由 blocks-runtime 注入（2026-10-26 方式一）——
 * hero 统计数字墙（site_stats）与伙伴墙（partners）DB 优先、烘焙兜底；
 * 后台保存时 revalidatePath('/') 立即失效 + ISR 300s 兜底。
 * 其余首页内容仍为复刻快照。
 */
export const revalidate = 300;

export const metadata: Metadata = replicaMetadata('/');

export default async function HomePage() {
  const page = await getRuntimeReplicaPage('/');
  if (!page) notFound();
  return (
    <>
      {/* 结构与 ReplicaPage 保持一致：参考 CSS → 双类名设计层容器 → 内容 → 交互层 */}
      <link rel="stylesheet" href="/opc/reference-blue.css" precedence="opc-reference" />
      <div className="opc-replica opc-replica" data-opc-replica>
        <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
        <ReplicaInteractions key={page.path} route={page.path} />
        <HashRouteBridge />
      </div>
    </>
  );
}
