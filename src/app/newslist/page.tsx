import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { replicaMetadata } from '@/components/opc/ReplicaPage';
import ReplicaInteractions from '@/components/opc/ReplicaInteractions';
import HashRouteBridge from '@/components/opc/HashRouteBridge';
import { getReplicaListPage } from '@/lib/opc/news-runtime';

/**
 * /newslist 的显式路由（优先于 catch-all）：
 * 运行时从 Supabase news_posts 渲染卡片（DB 优先、快照兜底），
 * ISR 300s + 后台发布时 revalidatePath 立即失效（见 lib/admin/news-server.ts）。
 */
export const revalidate = 300;

export const metadata: Metadata = replicaMetadata('/newslist');

export default async function NewsListPage() {
  const page = await getReplicaListPage('/newslist');
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
