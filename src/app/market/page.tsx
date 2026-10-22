import ReplicaPage, { replicaMetadata } from '@/components/opc/ReplicaPage';

export const metadata = replicaMetadata('/market');

export default function MarketPage() {
  return <ReplicaPage pathname="/market" />;
}
