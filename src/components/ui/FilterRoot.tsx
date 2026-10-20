'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * 客户端筛选容器。
 *
 * ## 为什么需要它
 *
 * 列表页若在服务端 `await searchParams`，页面会变成**动态渲染**，
 * Next.js 会把整块 `<title>` / `<meta name="description">` 一起 flush 到
 * `</body>` 之后 —— 实测 `/agents`、`/market`、`/news` 三个页面 head 里
 * **没有** title 与 description，搜索引擎与 Lighthouse 都读不到。
 * （静态页如 `/agents/[slug]` 正常，head_end 之前就有。）
 *
 * ## 做法
 *
 * 页面不再 `await searchParams`，改为**服务端渲染全部条目**（SEO 友好，
 * 条目内容完整落在 HTML 里），筛选在客户端按 URL 查询参数执行：
 *
 * - `[data-filter-key]`：条目的分类键，需与 `param` 的参数值相等（或参数为空）；
 * - `[data-filter-text]`：条目的可检索文本，`q` 参数做子串匹配；
 * - `[data-filter-option]`：筛选按钮，用 `data-active` 标记选中态；
 * - `[data-filter-count]`：结果条数。
 *
 * 纯 DOM 操作，不触发 React 重渲染，也不引入额外依赖。
 */
export default function FilterRoot({
  param,
  queryParam = 'q',
  defaultValue = '',
  children,
  className,
}: {
  /** 分类参数名，如 category / tab */
  param: string;
  /** 文本检索参数名，默认 q */
  queryParam?: string;
  /** URL 未带该参数时的默认分类值（如 /market 默认企业需求） */
  defaultValue?: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const apply = () => {
      const sp = new URLSearchParams(window.location.search);
      const active = sp.get(param) ?? defaultValue;
      const q = (sp.get(queryParam) ?? '').trim().toLowerCase();

      root.querySelectorAll<HTMLElement>('[data-filter-key]').forEach((el) => {
        const key = el.getAttribute('data-filter-key') ?? '';
        const text = (el.getAttribute('data-filter-text') ?? '').toLowerCase();
        const hitKey = !active || key === active;
        const hitText = !q || text.includes(q);
        el.style.display = hitKey && hitText ? '' : 'none';
      });

      // 筛选按钮选中态（空串选项代表「全部」）
      root.querySelectorAll<HTMLElement>('[data-filter-option]').forEach((el) => {
        const v = el.getAttribute('data-filter-option') ?? '';
        const on = v === active;
        el.dataset.active = on ? 'true' : 'false';
        if (on) el.setAttribute('aria-current', 'true');
        else el.removeAttribute('aria-current');
      });

      // 结果条数
      const counter = root.querySelector('[data-filter-count]');
      let shown = 0;
      root.querySelectorAll<HTMLElement>('[data-filter-key]').forEach((el) => {
        if (el.style.display !== 'none') shown += 1;
      });
      if (counter) counter.textContent = String(shown);

      // 空态提示（仅在真的没有结果时显示）
      root.querySelectorAll<HTMLElement>('[data-filter-empty]').forEach((el) => {
        el.style.display = shown === 0 ? '' : 'none';
      });

      // 同步隐藏表单里的分类输入框（如搜索框要带上当前分类）
      root.querySelectorAll<HTMLInputElement>('[data-filter-sync-input]').forEach((el) => {
        const name = el.getAttribute('data-filter-sync-input') ?? '';
        if (name === param) el.value = active;
      });
    };

    apply();
    window.addEventListener('popstate', apply);
    window.addEventListener('jizhi:filter-change', apply);
    return () => {
      window.removeEventListener('popstate', apply);
      window.removeEventListener('jizhi:filter-change', apply);
    };
  }, [param, queryParam, defaultValue]);

  return (
    <div ref={ref} className={className} data-filter-root={param}>
      {children}
    </div>
  );
}
