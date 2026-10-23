'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import { isReplicaPath } from '@/lib/opc/routes';
import JsonLd from '@/components/ui/JsonLd';
import { publicChromeMode } from '@/lib/site/navigation';

/** Keep the existing operations area independent of the reproduced public website. */
export default function SiteChrome({ children, legacyEntities }: { children: React.ReactNode; legacyEntities?: Record<string, unknown>[] }) {
  const pathname = usePathname();
  const reference = isReplicaPath(pathname) || pathname.toLowerCase() === '/webnew/index.html';
  const mode = publicChromeMode(pathname);
  const independent = mode === 'independent';
  return <>
    {!reference && !independent && legacyEntities && <JsonLd data={legacyEntities} />}
    {!independent && <Header home={mode === 'home'} />}
    <main id="main" className={independent ? undefined : mode === 'home' ? 'public-main public-main-home' : 'public-main'}>{children}</main>
    {!reference && !independent && <Footer />}
  </>;
}
