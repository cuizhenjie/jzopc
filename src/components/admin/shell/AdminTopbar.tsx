'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { FLAT_NAV, findNavByPath, type AdminChromeSession } from './admin-nav';
import { AdminIcon } from './AdminIcons';

/**
 * 后台顶栏（粘性，高度 var(--admin-topbar-h)=56px）：
 * 移动端汉堡开抽屉 + 面包屑（分组 / 模块）｜快速跳转（⌘K）+ 查看站点 + 用户。
 * 面包屑归属由 findNavByPath 统一计算，与侧栏高亮同源。
 */
export default function AdminTopbar({
  session,
  drawerOpen,
  onOpenDrawer,
}: {
  session: AdminChromeSession | null;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
}) {
  const pathname = usePathname();
  const match = findNavByPath(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-[var(--admin-topbar-h)] shrink-0 items-center justify-between gap-3 border-b border-[var(--color-line)]/80 bg-white/75 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="打开菜单"
          aria-expanded={drawerOpen}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--color-line)] text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-brand-navy)] lg:hidden"
        >
          <AdminIcon name="menu" />
        </button>
        <nav aria-label="位置" className="flex min-w-0 items-baseline gap-1.5">
          {match ? (
            <>
              <span className="shrink-0 text-[12px] text-[var(--color-ink-3)]">{match.group.title}</span>
              <span aria-hidden="true" className="text-[12px] text-[var(--color-ink-3)]/50">
                /
              </span>
              <span className="truncate text-[13px] font-semibold text-[var(--color-brand-navy)]">
                {match.item.label}
              </span>
            </>
          ) : (
            <span className="text-[13px] font-semibold text-[var(--color-brand-navy)]">管理后台</span>
          )}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <QuickJump />
        <Link
          href="/"
          target="_blank"
          className="hidden items-center gap-1.5 rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-[12px] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-brand-blue-deep)]/40 hover:text-[var(--color-brand-blue-deep)] md:inline-flex"
        >
          查看站点
          <AdminIcon name="externalLink" className="h-3.5 w-3.5" />
        </Link>
        {session && (
          <span className="hidden items-center gap-2 lg:flex">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-brand-navy)]/10 text-[11px] font-semibold text-[var(--color-brand-navy)]">
              {session.displayName.slice(0, 1)}
            </span>
            <span className="max-w-[140px] truncate text-[12px] font-medium text-[var(--color-ink-2)]">
              {session.displayName}
            </span>
          </span>
        )}
      </div>
    </header>
  );
}

/**
 * 快速跳转：按模块名 / 路径前缀过滤导航树的 combobox。
 * ⌘K / Ctrl+K 全局聚焦（在后台任何位置），↑↓ 选择、Enter 跳转、Esc 收起。
 */
function QuickJump() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const keyword = query.trim().toLowerCase();
  const results =
    keyword === ''
      ? []
      : FLAT_NAV.filter(
          (item) => item.label.toLowerCase().includes(keyword) || item.href.toLowerCase().includes(keyword),
        );

  function go(item: (typeof FLAT_NAV)[number]) {
    router.push(item.href);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  // ⌘K / Ctrl+K 全局聚焦（已聚焦时 focus 是 no-op）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 点击面板外部收起
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-3)]">
        <AdminIcon name="search" className="h-4 w-4" />
      </span>
      <input
        ref={inputRef}
        // 用 text 而非 search 类型：仓库契约禁止站内出现 search 类型输入框
        // （test/market-search.test.ts）；这里是模块跳转 combobox，不是站内搜索
        type="text"
        value={query}
        placeholder="快速跳转模块… ⌘K"
        aria-label="快速跳转"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="admin-quickjump-list"
        aria-autocomplete="list"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation(); // 只收起本面板，不联动关闭移动端抽屉
            setOpen(false);
            inputRef.current?.blur();
            return;
          }
          if (results.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIndex((i) => (i + 1) % results.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIndex((i) => (i - 1 + results.length) % results.length);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            go(results[index] ?? results[0]);
          }
        }}
        className="h-8 w-[170px] rounded-lg border border-[var(--color-line)] bg-white/80 pl-8 pr-2.5 text-[12.5px] text-[var(--color-ink)] transition-colors placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-brand-blue-deep)]/50 focus:outline-none lg:w-[210px]"
      />
      {open && results.length > 0 && (
        <ul
          id="admin-quickjump-list"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-[var(--color-line)] bg-white py-1 shadow-[var(--shadow-overlay)]"
        >
          {results.map((item, i) => (
            <li key={item.key} role="option" aria-selected={i === index}>
              <button
                type="button"
                onMouseEnter={() => setIndex(i)}
                onClick={() => go(item)}
                className={clsx(
                  'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12.5px] transition-colors',
                  i === index
                    ? 'bg-[var(--color-surface)] font-medium text-[var(--color-brand-navy)]'
                    : 'text-[var(--color-ink-2)]',
                )}
              >
                <span className="truncate">{item.label}</span>
                <span className="shrink-0 text-[10.5px] text-[var(--color-ink-3)]">{item.groupTitle}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
