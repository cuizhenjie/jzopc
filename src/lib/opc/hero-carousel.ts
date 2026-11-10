/** 首页首屏轮播。步骤条和左右按钮挂在 `.hero` 上，不放进 `.hero__bg`。 */

export const HERO_AUTOPLAY_MS = 8000;

/** 按张数环绕。count ≤ 0 时停在 0。 */
export function stepIndex(current: number, count: number, delta: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const base = Number.isFinite(current) ? Math.trunc(current) : 0;
  const step = Number.isFinite(delta) ? Math.trunc(delta) : 0;
  const next = (base + step) % count;
  return next < 0 ? next + count : next;
}

const PREV_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M15 6 L9 12 L15 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const NEXT_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M9 6 L15 12 L9 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function isSlide(node: Element): node is HTMLElement {
  return node instanceof HTMLElement && node.classList.contains('hero__slide');
}

/**
 * 给当前文档里的首屏挂上轮播。没有 `.hero` 或没有幻灯片时什么都不做。
 * 返回的函数卸掉按钮、监听和自动播放。一张图时只点亮它，不显示控件。
 */
export function mountHeroCarousel(doc: Document): () => void {
  const hero = doc.querySelector<HTMLElement>('.hero');
  const bg = hero?.querySelector<HTMLElement>(':scope > .hero__bg');
  if (!hero || !bg) return () => {};

  const slides = Array.from(bg.children).filter(isSlide);
  if (slides.length === 0) return () => {};

  const view = doc.defaultView;
  const ac = new AbortController();
  const { signal } = ac;
  bg.classList.add('is-live');

  let index = slides.findIndex((slide) => slide.classList.contains('is-on'));
  if (index < 0) index = 0;

  const steps: HTMLButtonElement[] = [];
  const injected: HTMLElement[] = [];
  let timer: number | null = null;
  let paused = false;
  const reduced = view?.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  const noAnim = /(?:^|[?&])noanim(?:[=&]|$)/.test(view?.location.search ?? '');

  const paint = (next: number) => {
    index = stepIndex(next, slides.length, 0);
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-on', i === index);
    });
    steps.forEach((step, i) => {
      const on = i === index;
      step.classList.toggle('is-on', on);
      step.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  };

  const stop = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const start = () => {
    stop();
    if (slides.length < 2 || reduced || noAnim || paused || doc.visibilityState === 'hidden' || !view) return;
    timer = view.setInterval(() => {
      paint(stepIndex(index, slides.length, 1));
    }, HERO_AUTOPLAY_MS);
  };

  const go = (delta: number) => {
    paint(stepIndex(index, slides.length, delta));
    start();
  };

  if (slides.length > 1) {
    const prev = doc.createElement('button');
    prev.type = 'button';
    prev.className = 'hero__nav hero__nav--prev';
    prev.setAttribute('aria-label', '上一张');
    prev.innerHTML = PREV_ICON;

    const next = doc.createElement('button');
    next.type = 'button';
    next.className = 'hero__nav hero__nav--next';
    next.setAttribute('aria-label', '下一张');
    next.innerHTML = NEXT_ICON;

    const bar = doc.createElement('div');
    bar.className = 'hero__steps';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', '首屏图片');

    prev.addEventListener('click', () => go(-1), { signal });
    next.addEventListener('click', () => go(1), { signal });

    slides.forEach((_, i) => {
      const step = doc.createElement('button');
      step.type = 'button';
      step.className = 'hero__step';
      step.setAttribute('role', 'tab');
      step.setAttribute('aria-label', `第 ${i + 1} 张`);
      step.addEventListener('click', () => {
        paint(i);
        start();
      }, { signal });
      steps.push(step);
      bar.append(step);
    });

    const pause = () => {
      paused = true;
      stop();
    };
    const resume = () => {
      paused = false;
      start();
    };
    for (const el of [prev, next, bar]) {
      el.addEventListener('mouseenter', pause, { signal });
      el.addEventListener('mouseleave', resume, { signal });
      el.addEventListener('focusin', pause, { signal });
      el.addEventListener('focusout', resume, { signal });
    }

    hero.append(prev, next, bar);
    injected.push(prev, next, bar);

    doc.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const active = doc.activeElement;
      if (!(active instanceof HTMLElement) || !hero.contains(active)) return;
      if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable) return;
      event.preventDefault();
      go(event.key === 'ArrowLeft' ? -1 : 1);
    }, { signal });

    doc.addEventListener('visibilitychange', () => {
      if (doc.visibilityState === 'hidden') stop();
      else start();
    }, { signal });
  }

  paint(index);
  start();

  return () => {
    stop();
    ac.abort();
    for (const node of injected) node.remove();
    bg.classList.remove('is-live');
    if (slides[0] && !slides.some((slide) => slide.classList.contains('is-on'))) {
      slides[0].classList.add('is-on');
    }
  };
}
