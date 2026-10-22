import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getReplicaPage } from '@/lib/opc/content';
import ReplicaInteractions from './ReplicaInteractions';
import HashRouteBridge from './HashRouteBridge';

export type ReplicaQuery = Record<string, string | string[] | undefined>;

export function replicaMetadata(pathname: string, query: ReplicaQuery = {}): Metadata {
  const page = getReplicaPage(pathname, query);
  if (!page) return { title: { absolute: '页面未找到 · OPC Store' } };
  return {
    title: { absolute: page.title },
    description: '同橙OPC社区，线上虚拟平台与线下实体空间，为OPC创业者提供全生命周期服务。',
    keywords: ['OPC', 'AI 创业', '智能体', '交易市场', '创业社区', '科技蓝'],
    alternates: { canonical: pathname === '/newsdetail' && query.id ? `${pathname}?id=${encodeURIComponent(String(query.id))}` : pathname },
    openGraph: { type: 'website', locale: 'zh_CN', title: page.title, siteName: 'OPC Store', images: [] },
    twitter: { card: 'summary', title: page.title, images: [] },
  };
}

export default function ReplicaPage({ pathname, query = {} }: { pathname: string; query?: ReplicaQuery }) {
  const page = getReplicaPage(pathname, query);
  if (!page) notFound();
  return <>
    <link rel="stylesheet" href="/opc/reference-blue.css" precedence="opc-reference" />
    <div className="opc-replica" data-opc-replica>
      <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
      <ReplicaInteractions key={page.path + JSON.stringify(query)} route={page.path} />
      <HashRouteBridge />
    </div>
  </>;
}
