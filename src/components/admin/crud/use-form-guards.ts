'use client';

import { useEffect, type RefObject } from 'react';

/**
 * 编辑便利性三件套：常驻保存快捷键 + 脏数据离页守卫 + 校验失败定位。
 *
 * 后台表单页迁入常驻外壳后，右侧内容区本身是滚动容器、没有窗口级
 * 滚动条，「保存」按钮可能已滚出视口——所以 ⌘S 快捷键与脏数据守卫
 * 统一收敛到这个 hook，各表单（NewsForm / ResourceForm）共用一份实现。
 */

/**
 * 1) ⌘/Ctrl + S 常驻保存：preventDefault 后用 form.requestSubmit() 走
 *    React 的 onSubmit（而不是原生提交），与点击保存按钮完全同路径；
 * 2) beforeunload 脏数据守卫：有未保存修改且不在提交中时，刷新/关闭
 *    页面前弹浏览器确认，避免误触丢稿。依赖变化时自动重挂监听。
 */
export function useFormGuards({
  formRef,
  dirty,
  busy,
}: {
  formRef: RefObject<HTMLFormElement | null>;
  dirty: boolean;
  busy: boolean;
}): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!busy) formRef.current?.requestSubmit();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [formRef, busy]);

  useEffect(() => {
    if (!dirty || busy) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, busy]);
}

/**
 * 校验失败定位：滚动到第一条带信息的字段并聚焦。
 *
 * 为什么返回 boolean——调用方在「没有任何字段错误、只有全局错误」时
 * 需要退而滚动全局错误条（rf-global-error / nf-global-error），
 * 用返回值区分两种情况，避免调用方自己再遍历一遍 errors。
 *
 * @param idFor 错误键 → 控件 id 的兜底映射：NewsForm 里 bodyHtml 的
 *   控件 id 是 nf-body、published_at 是 nf-published-at（连字符短名），
 *   与错误键不一致，由调用方传入映射保持本函数通用。
 */
export function scrollToFirstError(
  errors: Record<string, string>,
  idPrefix = '',
  idFor?: (key: string) => string,
): boolean {
  const firstKey = Object.keys(errors).find((k) => errors[k]);
  if (!firstKey) return false;
  const el = document.getElementById(idFor ? idFor(firstKey) : `${idPrefix}${firstKey}`);
  if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  // 可交互元素顺带聚焦（preventScroll：滚动已由 scrollIntoView 平滑完成，避免二次跳动）
  if (el.matches('input:not([type="hidden"]), textarea, select, button, a[href], [tabindex], [contenteditable="true"]')) {
    el.focus({ preventScroll: true });
  }
  return true;
}
