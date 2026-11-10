import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReferenceInteractions from '@/components/opc/ReferenceInteractions';
import type { ReplicaQuery } from '@/components/opc/ReplicaPage';
import { getReplicaDetailPage } from '@/lib/opc/news-runtime';

/**
 * /newsdetail 的显式路由：
 * DB 唯一事实源——数字 id 映射 slug=opc-N 查库，slug id 直接查库，
 * 未配库 / 查询异常 / 库内无此文一律 404（不再回落遗留快照）。
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
  if (!page) return { title: { absolute: '页面未找到 · 集智 AI' } };
  return {
    title: { absolute: page.title },
    description: '集智 AI OPC 社区 —— 集美科技旗下，位于北京市丰台区集美家居大红门店3号厅2层 集智OPC社区的一站式 AI 应用综合赋能平台。',
    keywords: ['集智AI', 'OPC', 'AI 创业', '社区动态', '北京丰台'],
    alternates: { canonical: `/newsdetail?id=${encodeURIComponent(id)}` },
    openGraph: { type: 'website', locale: 'zh_CN', title: page.title, siteName: '集智 AI OPC 社区', images: [] },
    twitter: { card: 'summary', title: page.title, images: [] },
  };
}

export default async function NewsDetailPage(props: PageProps) {
  const { page, id } = await resolve(props);
  if (!page) notFound();
  return (
    <div className="opc-replica" data-opc-replica>
      <div id="opc-page-content" data-opc-page={page.path} dangerouslySetInnerHTML={{ __html: page.html }} />
      <ReferenceInteractions key={`${page.path}?id=${id}`} route={page.path} />
    </div>
  );
}
