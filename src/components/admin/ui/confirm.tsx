'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/admin/ui/alert-dialog';

/**
 * window.confirm 的 shadcn 替代：Promise 化的确认弹窗。
 *
 * 用法（表格行操作等命令式场景）：
 *   const confirm = useConfirm();
 *   if (await confirm({ title: '删除', description: '…', actionLabel: '删除' })) { … }
 *
 * 同一组件树里每个 hook 实例自带一张弹窗；description 支持 ReactNode（名字加粗等）。
 */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description: ReactNode;
    actionLabel: string;
    actionVariant: 'default' | 'destructive';
    dangerHint?: string;
  } | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback(
    (opts: {
      title: string;
      description?: ReactNode;
      actionLabel?: string;
      cancelLabel?: string;
      destructive?: boolean;
      dangerHint?: string;
    }) =>
      new Promise<boolean>((resolve) => {
        // 上一个未决确认直接判 false，避免双弹窗串台
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setState({
          open: true,
          title: opts.title,
          description: opts.description ?? '',
          actionLabel: opts.actionLabel ?? (opts.destructive ? '删除' : '确定'),
          actionVariant: opts.destructive ? 'destructive' : 'default',
          dangerHint: opts.dangerHint,
        });
      }),
    [],
  );

  const settle = useCallback((v: boolean) => {
    setState(null);
    resolverRef.current?.(v);
    resolverRef.current = null;
  }, []);

  const element = state ? (
    <AlertDialog open={state.open} onOpenChange={(open) => !open && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state.title}</AlertDialogTitle>
          {state.description && <AlertDialogDescription>{state.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>取消</AlertDialogCancel>
          <AlertDialogAction variant={state.actionVariant} onClick={() => settle(true)}>
            {state.actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return [confirm, element] as const;
}
