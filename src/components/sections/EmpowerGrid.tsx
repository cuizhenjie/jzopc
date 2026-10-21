import Link from 'next/link';
import { empowerModules } from '@/lib/site/config';
import { chainModules } from '@/lib/site/chain';
import EmpowerIcon from '@/components/ui/EmpowerIcon';

/**
 * 链路的 6 个节点渲染成 3 列卡片矩阵（卡片区两档制中的「主卡」，
 * 见 lib/site/chain.ts 的叙事约定：6 节点链路 + 2 个贯穿全链的支撑）。
 * 视觉纪律参照 open-design：单强调色、1px 描边、hover 才给阴影与浮起。
 */
export default function EmpowerGrid() {
  const modules = chainModules
    .map(({ slug, label }, index) => {
      const module = empowerModules.find((item) => item.slug === slug);
      return module ? { ...module, label, index } : null;
    })
    .filter((module): module is NonNullable<typeof module> => Boolean(module));

  return (
    <ol className="empower-grid" id="empower">
      {modules.map((module) => (
        <li key={module.slug}>
          <Link href={module.href} className="empower-card">
            <div className="empower-card-top">
              <span className="empower-card-icon"><EmpowerIcon slug={module.slug} /></span>
              <span className="empower-card-step tnum">{String(module.index + 1).padStart(2, '0')} · {module.label}</span>
            </div>
            <h3>{module.title}</h3>
            <p>{module.tagline}</p>
            <span className="empower-card-more">
              了解更多
              <span className="empower-card-arrow" aria-hidden="true">→</span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
