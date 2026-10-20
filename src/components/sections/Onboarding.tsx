import Link from 'next/link';
import { empowerModules } from '@/lib/site/config';
import { Stagger } from '@/components/ui/Reveal';

/**
 * 「入驻之后，你可以在社区里做的 8 件事」。
 *
 * 依据：竞品审查 docs/05 §6.5-A 第 9 项 —— 行业通行做法是把"入驻后自动触发服务流程"
 * （工位分配、门禁、水电账户、政策提醒、对接人推送、首周服务指南）做成平台能力，
 * 而启创动力对行业的诊断是"签约前热情、签约后冷淡"（docs/05 §5.4）。
 *
 * 因此本模块把八大赋能**行动化**：每一条对应入驻者真实会做的一件事，
 * 而不是一个功能名。所有文案均可回溯到 docx 原文的八大赋能表，
 * 不含任何未经业务方确认的时效/价格承诺。
 */
const actions: Record<string, string> = {
  space: '领到工位或独立办公室；工商、财税、法务的办事窗口就在楼里。',
  agents: '挑一个能干活的数字员工，把写文档、出图、出视频这类重复的活儿交出去。',
  compute: '按需开 GPU 资源、接大模型 API，算力券一并对接。',
  academy: '选一门实战课或研学班，把项目需要的技能补上。',
  enterprise: '人、财、税、法四项基础服务打包对接，后台的事交给专业的人。',
  market: '发布你的能力或需求，在社区内部与外部 1000+ 家企业需求之间撮合。',
  traffic: '接入楼内的 AIGC 流量生产基地，让产品在谈成交之前先被看见。',
  capital: '对接创投机构，协助申报 AI OPC 相关政策。',
};

export default function Onboarding() {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[17px] font-semibold text-[var(--color-brand-navy)]">
          入驻之后，你可以在社区里做这 8 件事
        </h3>
        <span className="text-[12px] text-[var(--color-ink-3)]">对应八大赋能 · 点击查看详情</span>
      </div>

      <Stagger className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2" step={0.05}>
        {empowerModules.map((m) => (
          <div key={m.slug}>
            <Link
              href={m.href}
              className="group flex items-start gap-3.5 border-b border-[var(--color-line)] py-4 transition-colors duration-200 last:border-b-0 hover:bg-[var(--color-surface)]"
            >
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[11px] font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#0968AB,#0E3769)' }}
              >
                {m.index}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-[var(--color-brand-navy)] transition-colors group-hover:text-[var(--color-brand-blue-deep)]">
                  {m.title}
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-[var(--color-ink-2)]">
                  {actions[m.slug]}
                </span>
              </span>
            </Link>
          </div>
        ))}
      </Stagger>

      <p className="mt-6 border-t border-[var(--color-line)] pt-5 text-[13px] leading-relaxed text-[var(--color-ink-3)]">
        我们把这些写清楚，是不想让你在签约之后才发现该有的没有。合同里承诺的，官网里都能查到。
      </p>
    </div>
  );
}
