import Link from 'next/link';
import type { ReactNode } from 'react';
import JsonLd from '@/components/ui/JsonLd';
import PageHeroFx from '@/components/anim/PageHeroFx';
import { site } from '@/lib/site/config';

export type Crumb = { label: string; href?: string };

/**
 * 面包屑结构化数据（PRD FR-SITE-03）。
 *
 * 15 个内页的 `crumbs` 约定：**最后一级是当前页，没有 `href`**（可见面包屑里
 * 也正是这么渲染的 —— 当前页渲染成 `<span aria-current="page">`）。
 *
 * - `name` 逐字取调用方传入的 `crumb.label`，这里不另写一份文案，避免与页面可见内容不一致。
 * - `item` 必须是绝对 URL，用 `new URL(crumb.href, site.url)` 补全域名。
 * - **最后一级省略 `item` 字段**：Google 明确允许路径最后一项不带 `item`
 *   （"You can omit item for the last breadcrumb"），当前页的 URL 在这里也拿不到 ——
 *   PageHero 必须保持静态服务端组件，不能用 `headers()` / `cookies()` / `usePathname()`
 *   （那会让 15 个内页全部变成动态渲染，`<title>` 与 `<meta name="description">`
 *   会被 Next.js flush 到 `</body>` 之后，搜索引擎读不到）。
 *   所以**不编造**当前页 URL，只保留 `name` 与 `position`。
 */
function buildBreadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => {
      const listItem: { '@type': 'ListItem'; position: number; name: string; item?: string } = {
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.label,
      };
      // 有 href 才有目标页面 URL；当前页（最后一级）无 href，按上面说明省略 `item`
      if (crumb.href) {
        try {
          listItem.item = new URL(crumb.href, site.url).toString();
        } catch {
          // href 不是合法 URL 时宁可省略 `item`，也不输出编造的地址
        }
      }
      return listItem;
    }),
  };
}

export default function PageHero({ eyebrow, title, desc, crumbs = [], children }: { eyebrow?: string; title: ReactNode; desc?: ReactNode; crumbs?: Crumb[]; children?: ReactNode }) {
  // 单个 crumb 构不成路径，不输出结构化数据
  const breadcrumbJsonLd = crumbs.length >= 2 ? buildBreadcrumbJsonLd(crumbs) : null;

  return (
    <section data-nav-theme="light" data-public-hero="" className="page-hero opc-visual-hero">
      <div className="opc-visual-hero-art" aria-hidden="true">
        <img className="opc-visual-hero-image" src="/opc/visual/hero-city-12-960.webp" alt="" width={960} height={540} decoding="async" />
      </div>
      <PageHeroFx>
        {breadcrumbJsonLd && (
          <JsonLd data={breadcrumbJsonLd} attrs={{ 'data-breadcrumb-jsonld': 'BreadcrumbList' }} />
        )}
        <div className="site-container page-hero-content">
        {crumbs.length > 0 && <nav aria-label="面包屑" className="breadcrumbs"><ol>{crumbs.map((crumb, index) => <li key={`${index}-${crumb.label}`}>
          {index > 0 && <span aria-hidden="true" className="breadcrumb-separator">/</span>}
          {crumb.href ? <Link href={crumb.href}>{crumb.label}</Link> : <span aria-current={index === crumbs.length - 1 ? 'page' : undefined}>{crumb.label}</span>}
        </li>)}</ol></nav>}
        {eyebrow && <p className="page-hero-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {desc && <p className="page-hero-description">{desc}</p>}
          {children && <div className="page-hero-extra">{children}</div>}
        </div>
      </PageHeroFx>
    </section>
  );
}
