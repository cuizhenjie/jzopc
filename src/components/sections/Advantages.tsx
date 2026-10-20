import { advantages, visions } from '@/lib/site/config';
import { Reveal } from '@/components/ui/Reveal';

function NumberedList({ items, accent }: { items: readonly string[]; accent: 'blue' | 'teal' }) {
  return (
    <ol className="space-y-4">
      {items.map((t, i) => (
        <li key={t} className="flex items-start gap-4">
          <span
            className={
              accent === 'blue'
                ? 'mt-0.5 font-mono text-[15px] font-semibold text-[var(--color-brand-blue)]'
                : 'mt-0.5 font-mono text-[15px] font-semibold text-[var(--color-brand-teal)]'
            }
          >
            {String(i + 1).padStart(2, '0')}
          </span>
          <span className="text-[15px] leading-relaxed text-[var(--color-ink)]">{t}</span>
        </li>
      ))}
    </ol>
  );
}

export function Advantages() {
  return (
    <div>
      <Reveal>
        <h3 className="text-[20px] font-semibold text-[var(--color-brand-navy)]">
          为什么选择集智 AI OPC？
        </h3>
        <p className="mt-4 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
          集美科技旗下的一站式 AI 应用综合赋能平台，位于北京丰台大红门，首期 3000
          余平米。场地、工具、算力、人才、服务、订单、流量、资金，八件事装进同一个社区。
        </p>
      </Reveal>
      <Reveal delay={0.1} className="mt-8">
        <NumberedList items={advantages} accent="blue" />
      </Reveal>
    </div>
  );
}

export function Vision() {
  return (
    <div>
      <Reveal>
        <h3 className="text-[20px] font-semibold text-[var(--color-brand-navy)]">我们的愿景</h3>
        <p className="mt-4 text-[14px] leading-relaxed text-[var(--color-ink-2)]">
          集众智之力，启 AI 未来！成为 AI 创业者第一个想到的落脚点。让有想法的人不必先解决场地、算力和客户，就能把产品做出来、把生意跑起来。
        </p>
      </Reveal>
      <Reveal delay={0.1} className="mt-8">
        <NumberedList items={visions} accent="teal" />
      </Reveal>
    </div>
  );
}
