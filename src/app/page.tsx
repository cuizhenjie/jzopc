import ReplicaPage, { replicaMetadata } from '@/components/opc/ReplicaPage';

export const metadata = replicaMetadata('/');

export default function HomePage() {
  return <ReplicaPage pathname="/" />;
}
