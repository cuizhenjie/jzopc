'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import { isReplicaPath } from '@/lib/opc/routes';
import JsonLd from '@/components/ui/JsonLd';

/** Keep the existing operations area independent of the reproduced public website. */
export default function SiteChrome({ children, legacyEntities }: { children: React.ReactNode; legacyEntities?: Record<string, unknown>[] }) {
  const pathname = usePathname();
  const reference = isReplicaPath(pathname) || pathname.toLowerCase() === '/webnew/index.html';
  return <>
    {!reference && legacyEntities && <JsonLd data={legacyEntities} />}
    {!reference && <Header />}
    <main id="main">{children}</main>
    {!reference && <Footer />}
  </>;
}
