export type CountUpOptions = {
  value: number;
  duration?: number;
  decimals?: number;
};

export type CountUpAnimator = (options: {
  value: number;
  duration: number;
  onUpdate: (value: number) => void;
  onComplete: () => void;
}) => { kill: () => void };

export function formatCountUp(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return String(value);
  const precision = Number.isFinite(decimals) ? Math.max(0, Math.min(20, Math.trunc(decimals))) : 0;
  const [integer, fraction] = value.toFixed(precision).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

/** Own the observer, preference listener and tween for one SSR-rendered number. */
export function mountCountUp(
  element: HTMLElement,
  { value, duration = 1.6, decimals = 0 }: CountUpOptions,
  animate: CountUpAnimator,
): () => void {
  const finalText = formatCountUp(value, decimals);
  const view = element.ownerDocument.defaultView as (Window & typeof globalThis) | null;
  let disposed = false;
  let settled = false;
  let started = false;
  let observer: IntersectionObserver | undefined;
  let preference: MediaQueryList | undefined;
  let tween: ReturnType<CountUpAnimator> | undefined;
  let removePreference = () => {};

  const finish = () => {
    // Disable callbacks before kill: a tween may run one last callback while stopping.
    settled = true;
    observer?.disconnect();
    removePreference();
    const activeTween = tween;
    tween = undefined;
    activeTween?.kill();
    element.textContent = finalText;
  };
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    finish();
  };
  const onPreference = () => {
    if (!disposed && !settled && preference?.matches) finish();
  };

  element.textContent = finalText;
  try {
    preference = view?.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!view || !preference || preference.matches || typeof view.IntersectionObserver !== 'function'
      || !Number.isFinite(value) || !Number.isFinite(duration) || duration <= 0) {
      finish();
      return cleanup;
    }

    if (preference.addEventListener) {
      preference.addEventListener('change', onPreference);
      removePreference = () => preference?.removeEventListener('change', onPreference);
    } else if (preference.addListener) {
      preference.addListener(onPreference);
      removePreference = () => preference?.removeListener(onPreference);
    } else {
      // If changes cannot be observed, keep the readable static value.
      finish();
      return cleanup;
    }

    observer = new view.IntersectionObserver(entries => {
      if (disposed || settled || started
        || !entries.some(entry => entry.target === element && entry.isIntersecting)) return;
      started = true;
      observer?.disconnect();
      if (preference?.matches) {
        finish();
        return;
      }

      try {
        element.textContent = formatCountUp(0, decimals);
        const activeTween = animate({
          value,
          duration,
          onUpdate: current => {
            if (!disposed && !settled) element.textContent = formatCountUp(current, decimals);
          },
          onComplete: () => {
            if (!disposed && !settled) finish();
          },
        });
        // An animation adapter can complete synchronously before returning its handle.
        if (disposed || settled) activeTween.kill();
        else tween = activeTween;
      } catch {
        finish();
      }
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
    observer.observe(element);
    // Also disconnect when a polyfill reports an intersection during construction.
    if (started || settled || disposed) observer.disconnect();
  } catch {
    finish();
  }

  return cleanup;
}
