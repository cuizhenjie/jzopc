import Link from 'next/link';
import { footerNav, site, contentReady } from '@/lib/site/config';
import BrandMark from '@/components/ui/BrandMark';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[var(--color-line)] bg-[var(--color-surface)]">
      <div className="mx-auto w-full max-w-[1240px] px-5 py-14 sm:px-8 sm:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2.5">
              {/* 品牌徽记取自 logo.svg（浅底版），详见 components/ui/BrandMark */}
              <BrandMark />
              <span className="flex flex-col leading-none">
                <span className="text-[15px] font-semibold text-[var(--color-brand-navy)]">集智 AI</span>
                <span className="mt-0.5 text-[11px] tracking-[0.18em] text-[var(--color-ink-3)]">
                  JIZHI · AI
                </span>
              </span>
            </div>
            <p className="mt-5 max-w-xs text-[13px] leading-relaxed text-[var(--color-ink-2)]">
              {site.slogan}。{site.company}旗下，面向 AI 创业团队的一站式 AI 应用综合赋能平台。
            </p>
            <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-ink-3)]">
              {site.address} · 首期 {site.area} · {site.launch}启动运营
            </p>
            {/* 联系方式（PRD FR-HOME-09）：**有值才渲染**。
                `site.contact` 目前为空值 —— 业务方尚未提供对外电话/邮箱，
                不得臆造；填好配置后这里会自动出现对应条目。 */}
            {(site.contact.phone || site.contact.email) && (
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-3)]">
                {site.contact.phone && <span>电话 {site.contact.phone}</span>}
                {site.contact.phone && site.contact.email && <span> · </span>}
                {site.contact.email && <span>邮箱 {site.contact.email}</span>}
              </p>
            )}
          </div>

          {footerNav.map((col) => (
            <div key={col.title}>
              {/* 页脚分组标题用 h2：部分页面（如 /ops/leads 的口令页）正文只有 h1，
                  用 h3 会造成 h1 → h3 跳级，违反 heading 层级规则 */}
              <h2 className="text-[13px] font-semibold text-[var(--color-brand-navy)]">{col.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {/* 与导航一致：内容尚未就绪的子页不进链接列表（PRD FR-ABOUT-05）。
                    页面本身仍可通过直链访问 —— 那里有「内容筹备中」占位与留资表单。 */}
                {col.links.filter((l) => contentReady[l.href] !== false).map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      // inline-block + py-1：链接原本只有 15px 高（AA 要求 24×24）
                      className="inline-block py-1 text-[13px] text-[var(--color-ink-2)] transition-colors hover:text-[var(--color-brand-blue-deep)]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--color-line)] pt-6 text-[13px] text-[var(--color-ink-3)] sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.company} · 集智 AI OPC 社区
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {/* inline-block + py-0.5：底部链接原本 20px 高，补到 24px（WCAG 2.5.8 AA） */}
            <Link
              href="/about"
              className="inline-block py-1 transition-colors hover:text-[var(--color-brand-blue-deep)]"
            >
              关于我们
            </Link>
            <Link
              href="/apply"
              className="inline-block py-1 transition-colors hover:text-[var(--color-brand-blue-deep)]"
            >
              申请入驻
            </Link>
            <span>京ICP备 号位</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
