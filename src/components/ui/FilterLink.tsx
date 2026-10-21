'use client';

import type { ReactNode } from 'react';

/**
 * 筛选按钮（客户端跳转，不整页刷新）。
 *
 * 列表页改为静态渲染后，筛选由 `FilterRoot` 在客户端执行，
 * 因此按钮用 `history.pushState` 改 URL 并广播 `jizhi:filter-change`，
 * 而不是触发一次完整导航（否则会看到「全部条目 → 过滤后」的闪烁）。
 *
 * 真实的 `href` 保留：无 JS 时仍可用（整页导航后由 FilterRoot 的 effect
 * 应用过滤），右键「在新标签打开」也照常工作。
 *
 * 选中态由 `FilterRoot` 写入 `data-active`，样式见 `globals.css`。
 */
export default function FilterLink({
  href,
  param,
  value,
  className,
  children,
}: {
  href: string;
  /** 查询参数名 */
  param: string;
  /** 该选项对应的参数值；空串表示「全部」（即删除该参数） */
  value: string;
  className?: string;
  children: ReactNode;
}) {
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // 保留新标签打开等原生行为
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    e.preventDefault();
    const url = new URL(href, window.location.origin);
    // 保留地址栏里**其它**查询参数（如搜索词 q）。
    // 否则「先搜索、再切分类」时 q 会被丢掉 —— href 里只带了分类参数。
    for (const [key, val] of new URLSearchParams(window.location.search)) {
      if (key === param) continue;
      if (!url.searchParams.has(key)) url.searchParams.set(key, val);
    }
    if (value) url.searchParams.set(param, value);
    else url.searchParams.delete(param);
    window.history.pushState({}, '', url.toString());
    window.dispatchEvent(new Event('jizhi:filter-change'));
  };

  return (
    <a
      href={href}
      onClick={onClick}
      data-filter-option={value}
      data-active="false"
      className={className}
    >
      {children}
    </a>
  );
}
