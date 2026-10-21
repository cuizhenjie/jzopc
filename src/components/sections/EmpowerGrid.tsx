import Link from 'next/link';
import { empowerModules } from '@/lib/site/config';
import { chainModules } from '@/lib/site/chain';

export default function EmpowerGrid() {
  const modules = chainModules
    .map(({ slug }) => empowerModules.find((module) => module.slug === slug))
    .filter((module): module is (typeof empowerModules)[number] => Boolean(module));

  return (
    <ol className="service-list" id="empower">
      {modules.map((module, index) => (
        <li key={module.slug}>
          <Link href={module.href} className="service-link">
            <span className="service-number tnum">{String(index + 1).padStart(2, '0')}</span>
            <div><h3>{module.title}</h3><p>{module.tagline}</p></div>
            <span className="service-arrow" aria-hidden="true">↗</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
