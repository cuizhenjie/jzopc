import ReplicaPage, { replicaMetadata } from '@/components/opc/ReplicaPage';

export const metadata = replicaMetadata('/about');

export default function AboutPage() {
  return <ReplicaPage pathname="/about" />;
}
