import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getReplicaPage } from '@/lib/opc/content';
import ReferenceInteractions from './ReferenceInteractions';

export type ReplicaQuery = Record<string, string | string[] | undefined>;

/**
 * 参考站页面的元数据。
 * 标题来自烘焙产物（编译期取自参考站 <title>），描述与关键词为全站统一口径。
 */
export function replicaMetadata(pathname: string, _query: ReplicaQuery = {}): Metadata {
  const page = getReplicaPage(pathname);
  if (!page) return { title: { absolute: '页面未找到 · 集智 AI' } };
  return {
    title: { absolute: page.title },
    description:
      '集智 AI OPC 社区 —— 集美科技旗下，位于北京市丰台区集美家居大红门店3号厅2层 集智OPC社区的一站式 AI 应用综合赋能平台，以八大赋能体系服务 AI 创业团队与一人公司。',
    keywords: ['集智AI', 'OPC', 'AI 创业', '一人公司', '智能体', '供需发布', '大健康', '算力超市', '集智商学院', '北京丰台'],
    alternates: { canonical: pathname },
    openGraph: { type: 'website', locale: 'zh_CN', title: page.title, siteName: '集智 AI OPC 社区', images: [] },
    twitter: { card: 'summary', title: page.title, images: [] },
  };
}

/**
 * 复刻页外壳。
 *
 * 页面主体是编译期烘焙的快照（generated/pages.json），带 `data-opc-block` 标记的
 * 容器会在服务端由 blocks-runtime / news-runtime 换成后台数据；
 * 客户端行为由 ReferenceInteractions 按参考站语义接管。
 *
 * 样式：/opc/reference/main.css（参考站基线，已在编译期加 `.opc-site` 作用域前缀）
 * 与 /opc/reference/extension.css（补齐参考站自身缺失样式的部分）。
 */
export default function ReplicaPage({ pathname }: { pathname: string; query?: ReplicaQuery }) {
  const page = getReplicaPage(pathname);
  if (!page) notFound();
  return (
    <div className="opc-replica" data-opc-replica>
      <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
      <ReferenceInteractions route={page.path} />
    </div>
  );
}
