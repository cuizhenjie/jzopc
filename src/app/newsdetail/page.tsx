import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReplicaInteractions from '@/components/opc/ReplicaInteractions';
import HashRouteBridge from '@/components/opc/HashRouteBridge';
import type { ReplicaQuery } from '@/components/opc/ReplicaPage';
import { getReplicaDetailPage } from '@/lib/opc/news-runtime';

/**
 * /newsdetail 的显式路由（优先于 catch-all 的同步解析）：
 * DB 唯一事实源——数字 id 映射 slug=opc-N 查库，slug id 直接查库，
 * 未配库/查询异常/库内无此文一律 404（2026-10-28 起不再回落遗留快照）。
 * DB 纯文本逐段转义；富文本经允许列表净化后注入 article-shell。
 * ISR 300s + 后台发布时 revalidatePath 立即失效。
 */
export const revalidate = 300;

type PageProps = { searchParams: Promise<ReplicaQuery> };

const DEFAULT_ID = '392';

function firstQuery(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? DEFAULT_ID;
}

async function resolve(props: PageProps) {
  const query = await props.searchParams;
  const id = firstQuery(query.id);
  const page = await getReplicaDetailPage(id);
  return { page, id };
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { page, id } = await resolve(props);
  // 字段语义与 ReplicaPage.replicaMetadata 一致；标题来自双源解析结果
  if (!page) return { title: { absolute: '页面未找到 · 集智AI' } };
  return {
    title: { absolute: page.title },
    description: '集智 AI OPC 社区，线上虚拟平台与线下实体空间，为 OPC 创业者提供全生命周期服务。',
    keywords: ['集智AI', 'OPC', 'AI 创业', '智能体', '交易市场', '创业社区', '科技蓝'],
    alternates: { canonical: `/newsdetail?id=${encodeURIComponent(id)}` },
    openGraph: { type: 'website', locale: 'zh_CN', title: page.title, siteName: '集智AI', images: [] },
    twitter: { card: 'summary', title: page.title, images: [] },
  };
}

export default async function NewsDetailPage(props: PageProps) {
  const { page, id } = await resolve(props);
  if (!page) notFound();
  return (
    <>
      {/* 结构与 ReplicaPage 保持一致：参考 CSS → 双类名设计层容器 → 内容 → 交互层 */}
      <link rel="stylesheet" href="/opc/reference-blue.css" precedence="opc-reference" />
      <div className="opc-replica opc-replica" data-opc-replica>
        <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
        <ReplicaInteractions key={`${page.path}?id=${id}`} route={page.path} />
        <HashRouteBridge />
      </div>
    </>
  );
}
