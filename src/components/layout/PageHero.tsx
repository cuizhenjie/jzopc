import Link from 'next/link';
import type { ReactNode } from 'react';

export type Crumb = { label: string; href?: string };

export default function PageHero({ eyebrow, title, desc, crumbs = [], children }: { eyebrow?: string; title: ReactNode; desc?: ReactNode; crumbs?: Crumb[]; children?: ReactNode }) {
  return (
    <section data-nav-theme="dark" className="page-hero">
      <div className="page-hero-art" aria-hidden="true"><i /><i /><i /></div>
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
    </section>
  );
}
