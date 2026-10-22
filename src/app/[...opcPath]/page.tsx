import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReplicaPage, { replicaMetadata, type ReplicaQuery } from '@/components/opc/ReplicaPage';
import { isReplicaPath } from '@/lib/opc/routes';

type PageProps = {
  params: Promise<{ opcPath: string[] }>;
  searchParams: Promise<ReplicaQuery>;
};

async function location(props: PageProps) {
  const [{ opcPath }, query] = await Promise.all([props.params, props.searchParams]);
  const pathname = `/${opcPath.join('/')}`.toLowerCase();
  if (pathname === '/webnew/index.html') return { pathname: '/', query };
  if (!isReplicaPath(pathname)) notFound();
  return { pathname, query };
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { pathname, query } = await location(props);
  return replicaMetadata(pathname, query);
}

export default async function ReferencePage(props: PageProps) {
  return <ReplicaPage {...await location(props)} />;
}
