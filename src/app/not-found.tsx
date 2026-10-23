import type { Metadata } from 'next';
import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';

export const metadata: Metadata = {
  title: '页面未找到',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div
      data-nav-theme="light"
      className="mx-auto flex min-h-[70vh] w-full max-w-[1240px] flex-col items-center justify-center px-5 py-32 text-center sm:px-8"
    >
      <p className="font-mono text-[64px] font-semibold leading-none text-gradient sm:text-[88px]">404</p>
      <h1 className="mt-6 text-[24px] font-semibold text-[var(--color-brand-navy)] sm:text-[30px]">
        这个页面不存在
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--color-ink-2)]">
        链接可能已经失效，或者页面正在调整。可以从下面的入口继续。
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">回到首页</ButtonLink>
        <ButtonLink href="/agent" variant="secondary">
          浏览智能体
        </ButtonLink>
        <ButtonLink href="/market" variant="secondary">
          供需市场
        </ButtonLink>
        <ButtonLink href="/apply" variant="secondary">
          申请入驻
        </ButtonLink>
      </div>

      <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-[var(--color-ink-3)]">
        {[
          { label: '关于集智', href: '/about' },
          { label: '八大赋能', href: '/empower/space' },
          { label: '集智商学院', href: '/center' },
          { label: '社区动态', href: '/newslist' },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="transition-colors hover:text-[var(--color-brand-blue-deep)]">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
