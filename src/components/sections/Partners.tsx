import { Reveal } from '@/components/ui/Reveal';

export default function Partners({ names }: { names: string[] }) {
  return (
    <div>
      <Reveal>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h3 className="text-[22px] font-semibold text-[var(--color-brand-navy)]">合作企业</h3>
          <p className="text-[13px] text-[var(--color-ink-3)]">与众多知名企业达成深度合作</p>
        </div>
      </Reveal>
      <Reveal delay={0.1} className="mt-8">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {names.map((name) => (
            <li
              key={name}
              className="flex h-[68px] items-center justify-center rounded-xl border border-[var(--color-line)] bg-white px-3 text-center text-[13px] font-medium text-[var(--color-ink-2)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-brand-blue)]/30 hover:text-[var(--color-brand-blue)] hover:shadow-[var(--shadow-card)]"
            >
              {name}
            </li>
          ))}
        </ul>
      </Reveal>
    </div>
  );
}
