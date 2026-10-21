import Link from 'next/link';
import { empowerModules } from '@/lib/site/config';
import { supportModuleSlugs } from '@/lib/site/chain';

/** Two supporting services complement the six principal service entries. */
export default function EmpowerChain() {
  return (
    <div className="service-support">
      <div className="service-support-label">
        <span className="section-eyebrow">贯穿创业全程</span>
        <p>把人补齐，把后台的事交给专业的人。</p>
      </div>
      {supportModuleSlugs.map((slug) => {
        const module = empowerModules.find((item) => item.slug === slug);
        if (!module) return null;
        return <Link key={slug} href={module.href} className="support-link"><span>{module.title}</span><span aria-hidden="true">↗</span></Link>;
      })}
    </div>
  );
}
