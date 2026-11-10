'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import Footer from './Footer';
import JsonLd from '@/components/ui/JsonLd';
import { publicChromeMode } from '@/lib/site/navigation';

/**
 * 公开站外壳。
 *
 * `.opc-site` 是**参考站样式的作用域根**：/opc/reference/main.css 的所有选择器
 * 都被编译期加了 `.opc-site` 前缀（见 scripts/build-opc-reference.mjs），
 * 因此后台（Tailwind）与运营区完全不受参考站全局重置影响。
 */
export default function SiteChrome({ children, legacyEntities }: { children: React.ReactNode; legacyEntities?: Record<string, unknown>[] }) {
  const pathname = usePathname();
  const mode = publicChromeMode(pathname);
  const independent = mode === 'independent';

  if (independent) {
    return <main id="main" className="opc-independent">{children}</main>;
  }

  return (
    <div className="opc-site">
      {legacyEntities ? <JsonLd data={legacyEntities} /> : null}
      <Header />
      <main id="main">{children}</main>
      <Footer />
      {/* 回到顶部（参考站交互：由 ReferenceInteractions 接管显隐与点击） */}
      <button className="totop" type="button" aria-label="回到顶部">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 19V5" />
          <path d="m6 11 6-6 6 6" />
        </svg>
      </button>
    </div>
  );
}
