'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * 站内搜索输入框 —— **全站唯一的搜索原语**。
 *
 * 供需页、智能体页、全局搜索页三处搜索**都必须**用它，
 * 避免同一个功能在三处长成三个样子（这是「统一 UI 风格」的基础）。
 * `test/market-search.test.ts` 里有一条全站扫描守卫锁死这一点。
 *
 * ## 唯一用法：URL 驱动
 *
 * ```tsx
 * <SearchField param="q" basePath="/market" placeholder="搜索需求标题、分类或发布方" />
 * ```
 *
 * 组件自行读写地址栏的 `?q=`，并广播 `jizhi:filter-change` 事件 ——
 * 与 `FilterRoot` 的过滤机制天然对接（`FilterRoot` 本来就按 `data-filter-text`
 * 做关键词匹配）。查询词写在地址栏里，因此结果**可分享、可后退**。
 *
 * 刻意**不提供受控模式**：三处调用点都把查询词放进 URL（可分享是刚需），
 * 多一种模式就多一种「同一个功能两种行为」的可能。
 *
 * ## 视觉基线
 *
 * 沿用站内既有输入框（`h-10` / `rounded-lg` / 1px 描边 / `text-[14px]`），
 * 只是把边框提到外层容器上，这样聚焦时是**整块**高亮而不是只有输入框。
 */
export default function SearchField({
  param = 'q',
  basePath,
  placeholder = '搜索',
  label = '站内搜索',
  className,
  autoFocus,
}: {
  /** 查询参数名，默认 q */
  param?: string;
  /** 基础路径（默认取当前路径） */
  basePath?: string;
  placeholder?: string;
  /** 无障碍标签（视觉隐藏）——应写清「搜什么」，如「搜索供需条目」 */
  label?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // useId 保证同一页面出现多个搜索框时 id 不冲突（label 的 htmlFor 才有意义）。
  // 去掉 React 的分隔符，避免 id 里出现 `:` / `«` 这类不好写进 CSS 选择器的字符。
  const inputId = `search-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  // 挂载时从地址栏读回查询词
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setQuery(sp.get(param) ?? '');
    // 浏览器前进/后退时同步
    const onPop = () => setQuery(new URLSearchParams(window.location.search).get(param) ?? '');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [param]);

  /**
   * 自动聚焦：**不用** HTML 的 `autofocus` 属性。
   *
   * `autofocus` 会让浏览器把该元素**滚动进视口** —— /search 的输入框在
   * 页头与区块标题之下（首屏外），实测直接打开 /search 会把页面滚到
   * `scrollY ≈ 5132`，用户看到的是页面中部，页头和标题全丢了。
   * `focus({ preventScroll: true })` 只给焦点、不动滚动位置。
   */
  useEffect(() => {
    if (!autoFocus) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const update = (v: string) => {
    setQuery(v);
    const url = new URL(window.location.href);
    url.pathname = basePath ?? window.location.pathname;
    if (v.trim()) url.searchParams.set(param, v.trim());
    else url.searchParams.delete(param);
    // 用 replaceState 而不是 pushState：搜索是**逐字输入**的过程，
    // 每敲一个字就压一条历史会让「后退」按钮变得没法用（得点十几次）。
    window.history.replaceState({}, '', url.toString());
    // 让 FilterRoot 等订阅者立即重算过滤结果
    window.dispatchEvent(new Event('jizhi:filter-change'));
  };

  return (
    <div
      className={
        'flex h-10 items-center gap-2 rounded-lg border bg-white px-3 transition-colors ' +
        (focused
          ? 'border-[var(--color-brand-blue-deep)]'
          : 'border-[var(--color-line)]') +
        (className ? ` ${className}` : '')
      }
    >
      <svg
        viewBox="0 0 20 20"
        className="h-4 w-4 shrink-0 text-[var(--color-ink-3)]"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12.8 12.8 17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type="search"
        data-search-field="true"
        value={query}
        onChange={(e) => update(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        // 隐藏 WebKit 自带的清除按钮：否则会和自带的清空按钮叠成两个叉
        // h-full：让输入框撑满 40px 的容器 —— 否则输入框本体只有 23px 高，
        // 低于 WCAG 2.5.8 的 24×24 触控下限，容器上下缘是点不到的死区。
        // 字号：手机 16px（iOS Safari 聚焦 <16px 的输入框会自动放大整页），
        // ≥640px 回到 14px —— 与全站表单控件保持同一套规则。
        className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[var(--color-ink-3)] sm:text-[14px] [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
      />

      {query ? (
        <button
          type="button"
          onClick={() => {
            update('');
            inputRef.current?.focus();
          }}
          aria-label="清空搜索"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[var(--color-ink-3)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-brand-blue-deep)]"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      ) : null}

    </div>
  );
}
