/** Enhance one SSR-visible block. Every failure leaves its contents readable. */
export function mountReveal(element: HTMLElement, distance = 16): () => void {
  const document = element.ownerDocument;
  const view = document.defaultView as (Window & typeof globalThis) | null;
  const previousState = element.getAttribute('data-state');
  const previousImmediate = element.getAttribute('data-reveal-immediate');
  const previousY = element.style.getPropertyValue('--reveal-y');
  const previousYPriority = element.style.getPropertyPriority('--reveal-y');
  let disposed = false;
  let revealed = false;
  let observer: IntersectionObserver | undefined;
  let preference: MediaQueryList | undefined;
  let removePreference = () => {};

  const show = (immediate = false) => {
    if (disposed) return;
    revealed = true;
    observer?.disconnect();
    if (immediate) element.setAttribute('data-reveal-immediate', '');
    element.dataset.state = 'in';
  };
  const onFocus = () => show(true);
  const onPreference = () => { if (preference?.matches) show(true); };

  element.addEventListener('focusin', onFocus);
  try {
    preference = view?.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (preference?.addEventListener) {
      preference.addEventListener('change', onPreference);
      removePreference = () => preference?.removeEventListener('change', onPreference);
    } else if (preference?.addListener) {
      preference.addListener(onPreference);
      removePreference = () => preference?.removeListener(onPreference);
    }

    // Do not hide anything already on screen, close to its edge, or focused.
    if (!view || !preference || preference.matches || !view.IntersectionObserver
      || element.contains(document.activeElement)
      || element.getBoundingClientRect().top <= view.innerHeight + 24) {
      show(true);
    } else {
      observer = new view.IntersectionObserver(entries => {
        if (entries.some(entry => entry.target === element && entry.isIntersecting)) show();
      }, { rootMargin: '0px 0px -24px 0px', threshold: 0 });
      observer.observe(element);
      // Some observer polyfills deliver their first result synchronously.
      if (!revealed) {
        const y = Number.isFinite(distance) ? Math.max(-24, Math.min(24, distance)) : 16;
        element.style.setProperty('--reveal-y', `${y}px`);
        element.removeAttribute('data-reveal-immediate');
        element.dataset.state = 'pending';
      }
    }
  } catch {
    show(true);
  }

  return () => {
    disposed = true;
    observer?.disconnect();
    removePreference();
    element.removeEventListener('focusin', onFocus);
    if (previousState === null) element.removeAttribute('data-state');
    else element.setAttribute('data-state', previousState);
    if (previousImmediate === null) element.removeAttribute('data-reveal-immediate');
    else element.setAttribute('data-reveal-immediate', previousImmediate);
    if (previousY) element.style.setProperty('--reveal-y', previousY, previousYPriority);
    else element.style.removeProperty('--reveal-y');
  };
}
