'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';

/**
 * 全站错误边界（对应站点地图 P26 `/error`）。
 *
 * Next.js App Router 里，`error.tsx` 捕获**其下页面段**的渲染异常与未捕获错误。
 * 缺了它，任何页面报错都会落到 Next 的通用错误页 —— 品牌页面上出现框架默认文案，
 * 与「集智」的品牌感完全不符，也不给用户任何下一步。
 *
 * 注意：`error.tsx` 必须是 Client Component（要用 `useEffect` 记录错误）。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 生产环境应接自己的监控（错误上报 / 告警），当前先打日志
    console.error('[page-error]', error?.message, error?.digest);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-[640px] flex-col items-center justify-center px-5 py-32 text-center">
      <p className="text-[12px] font-medium tracking-[0.18em] text-[var(--color-brand-blue-deep)]">
        页面出错了
      </p>
      <h1 className="mt-4 text-[26px] font-semibold leading-tight text-[var(--color-brand-navy)] sm:text-[30px]">
        这一页没能正常打开
      </h1>
      <p className="mt-4 max-w-md text-[14px] leading-relaxed text-[var(--color-ink-2)]">
        可能是网络波动，也可能是我们刚更新了某些内容。你可以重试一次，或者回到首页继续浏览。
      </p>

      {error?.digest && (
        <p className="mt-3 font-mono text-[12px] text-[var(--color-ink-3)]">
          错误编号 {error.digest}
        </p>
      )}

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-blue-deep)] px-6 text-[15px] font-medium text-white shadow-[var(--shadow-card)] transition-all duration-300 hover:bg-[var(--color-brand-navy)] hover:-translate-y-0.5"
        >
          重试
        </button>
        <ButtonLink href="/" variant="secondary">
          回到首页
        </ButtonLink>
        <Link
          href="/apply"
          className="text-[14px] font-medium text-[var(--color-brand-blue-deep)] underline-offset-4 hover:underline"
        >
          直接给我们留言
        </Link>
      </div>
    </div>
  );
}
