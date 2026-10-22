import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getReplicaPage } from '@/lib/opc/content';
import ReplicaInteractions from './ReplicaInteractions';
import HashRouteBridge from './HashRouteBridge';
// 设计层（opc-tokens.css / opc-components.css）在 Root Layout 导入 ——
// Next.js 只允许全局 CSS 在根布局里 import。

export type ReplicaQuery = Record<string, string | string[] | undefined>;

export function replicaMetadata(pathname: string, query: ReplicaQuery = {}): Metadata {
  const page = getReplicaPage(pathname, query);
  if (!page) return { title: { absolute: '页面未找到 · 集智AI' } };
  return {
    title: { absolute: page.title },
    description: '集智 AI OPC 社区，线上虚拟平台与线下实体空间，为 OPC 创业者提供全生命周期服务。',
    keywords: ['集智AI', 'OPC', 'AI 创业', '智能体', '交易市场', '创业社区', '科技蓝'],
    alternates: { canonical: pathname === '/newsdetail' && query.id ? `${pathname}?id=${encodeURIComponent(String(query.id))}` : pathname },
    openGraph: { type: 'website', locale: 'zh_CN', title: page.title, siteName: '集智AI', images: [] },
    twitter: { card: 'summary', title: page.title, images: [] },
  };
}

export default function ReplicaPage({ pathname, query = {} }: { pathname: string; query?: ReplicaQuery }) {
  const page = getReplicaPage(pathname, query);
  if (!page) notFound();
  return <>
    {/* 顺序要紧：reference-blue.css 是原站结构基线，设计 token 与组件层在其后覆盖 */}
    <link rel="stylesheet" href="/opc/reference-blue.css" precedence="opc-reference" />
    {/* 双类名（opc-replica opc-replica）用于提升设计层选择器特异性。
        原站参考 CSS 的选择器带 data-v-* 属性限定（特异性 0,2,0），
        与单层 .opc-replica X 相同；两表都带 !important 时会按加载顺序决胜，
        而加载顺序不受 import 语句控制。双类名把设计层抬到 0,3,0，
        使设计层始终胜出，不依赖样式表注入顺序。 */}
    <div className="opc-replica opc-replica" data-opc-replica>
      <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
      <ReplicaInteractions key={page.path + JSON.stringify(query)} route={page.path} />
      <HashRouteBridge />
    </div>
  </>;
}
