'use client';

import { useEffect, useState, type RefObject } from 'react';

/** Observe the permanent scene shell, including while it only contains its poster. */
export function observeSceneActivity(
  element: HTMLElement,
  onChange: (active: boolean) => void,
  pauseOffscreen = true,
): () => void {
  let inView = !pauseOffscreen || typeof IntersectionObserver === 'undefined';
  const update = () => onChange(inView && document.visibilityState === 'visible');
  const observer = pauseOffscreen && typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(([entry]) => {
        inView = Boolean(entry?.isIntersecting);
        update();
      }, { threshold: 0 })
    : null;

  observer?.observe(element);
  document.addEventListener('visibilitychange', update);
  update();

  return () => {
    observer?.disconnect();
    document.removeEventListener('visibilitychange', update);
  };
}

export function useSceneActivity(ref: RefObject<HTMLElement | null>): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    return observeSceneActivity(ref.current, setActive);
  }, [ref]);
  return active;
}
