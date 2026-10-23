/** Progressive enhancement for the captured public pages. No source-site runtime is used. */
const REVEAL_TARGETS = [
  '.sec-head', '.ftr-node', '.eco-node', '.strength-block', '.news-card', '.tool-card', '.course-card',
  '.opc-card', '.rental-card', '.supply-card', '.demand-card', '.activity-item',
  '.opc-visual-section-head', '.opc-visual-photo-card', '.opc-visual-logo-grid',
].join(',');
const PERIOD = 5600;

function inViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
}

export function mountVisualMotion(root: HTMLElement): () => void {
  const cleanup: (() => void)[] = [];
  let alive = true;
  const listen = (target: EventTarget, type: string, handler: EventListener, options?: AddEventListenerOptions) => {
    target.addEventListener(type, handler, options);
    cleanup.push(() => target.removeEventListener(type, handler, options));
  };
  const remember = (element: HTMLElement, attributes: string[]) => {
    const previous = attributes.map(name => [name, element.getAttribute(name)] as const);
    cleanup.push(() => previous.forEach(([name, value]) => value === null ? element.removeAttribute(name) : element.setAttribute(name, value)));
  };
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = preference.matches;
  const revealTargets = new Set<HTMLElement>();
  let revealObserver: IntersectionObserver | undefined;
  const reveal = (element: HTMLElement) => {
    element.dataset.opcReveal = 'shown';
    revealObserver?.unobserve(element);
  };
  const showAll = () => revealTargets.forEach(reveal);

  remember(root, ['data-opc-motion-page-paused']);
  const syncPage = () => { root.dataset.opcMotionPagePaused = String(document.hidden || reduced); };
  syncPage();
  listen(document, 'visibilitychange', syncPage);
  const onPreference = () => {
    reduced = preference.matches;
    syncPage();
    if (reduced) showAll();
  };
  listen(preference, 'change', onPreference);

  // SSR and unsupported browsers show every item. Only below-screen items are
  // prepared after the observer exists; failures immediately restore visibility.
  if ('IntersectionObserver' in window && !reduced) {
    try {
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) reveal(entry.target as HTMLElement); });
      }, { rootMargin: '0px 0px -24px 0px', threshold: 0 });
      const candidates = Array.from(root.querySelectorAll<HTMLElement>(REVEAL_TARGETS))
        .map(element => ({ element, rect: element.getBoundingClientRect() }));
      candidates.forEach(({ element, rect }, index) => {
        if (!rect.width || rect.top <= window.innerHeight + 24) return;
        remember(element, ['data-opc-reveal']);
        const delay = element.style.getPropertyValue('--opc-reveal-delay');
        cleanup.push(() => delay ? element.style.setProperty('--opc-reveal-delay', delay) : element.style.removeProperty('--opc-reveal-delay'));
        element.style.setProperty('--opc-reveal-delay', `${index % 3 * 55}ms`);
        revealTargets.add(element);
        element.dataset.opcReveal = 'pending';
        revealObserver!.observe(element);
      });
    } catch {
      showAll();
      revealObserver?.disconnect();
    }
  }
  cleanup.push(() => { showAll(); revealObserver?.disconnect(); });
  listen(root, 'focusin', event => {
    for (let element = event.target instanceof HTMLElement ? event.target : null; element && root.contains(element); element = element.parentElement) {
      if (element.dataset.opcReveal === 'pending') reveal(element);
    }
  });

  const carousel = root.querySelector<HTMLElement>('.hero-carousel');
  const hero = carousel?.closest<HTMLElement>('.hero') ?? carousel;
  const slides = carousel ? Array.from(carousel.querySelectorAll<HTMLElement>('.el-carousel__item')) : [];
  let carouselVisible = hero ? inViewport(hero) : false;
  let reconcileCarousel = () => {};

  // Existing decorative CSS animations pause with their own section, rather
  // than running for the entire 20,000px document when the hero is visible.
  let regionObserver: IntersectionObserver | undefined;
  if ('IntersectionObserver' in window) {
    try {
      regionObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const element = entry.target as HTMLElement;
          const visible = entry.isIntersecting && entry.intersectionRatio > 0;
          element.dataset.opcMotionRegionVisible = String(visible);
          if (element === hero) { carouselVisible = visible; reconcileCarousel(); }
        });
      }, { threshold: [0, 0.01] });
      const regions = new Set(root.querySelectorAll<HTMLElement>('section'));
      if (hero) regions.add(hero);
      regions.forEach(element => {
        remember(element, ['data-opc-motion-region-visible']);
        element.dataset.opcMotionRegionVisible = String(inViewport(element));
        regionObserver!.observe(element);
      });
    } catch {
      regionObserver?.disconnect();
      root.querySelectorAll('[data-opc-motion-region-visible]').forEach(element => element.removeAttribute('data-opc-motion-region-visible'));
    }
  }
  cleanup.push(() => regionObserver?.disconnect());

  if (carousel && hero && slides.length > 1) {
    remember(carousel, ['role', 'aria-roledescription', 'aria-label', 'data-opc-slide', 'data-opc-autoplay', 'data-opc-pause-reason']);
    carousel.setAttribute('role', 'region');
    carousel.setAttribute('aria-roledescription', '轮播');
    carousel.setAttribute('aria-label', '集智AI主视觉');
    const container = document.createElement('div');
    container.className = 'opc-carousel-controls';
    container.dataset.opcGenerated = 'true';
    const dots = document.createElement('div');
    dots.className = 'opc-carousel-dots';
    dots.setAttribute('role', 'tablist');
    dots.setAttribute('aria-label', '选择主视觉');
    const buttons = slides.map((slide, index) => {
      remember(slide, ['id', 'role', 'aria-labelledby', 'aria-hidden', 'inert']);
      const originalClass = slide.className;
      const originalTransform = slide.style.getPropertyValue('transform');
      cleanup.push(() => {
        slide.className = originalClass;
        originalTransform ? slide.style.setProperty('transform', originalTransform) : slide.style.removeProperty('transform');
      });
      // The original Vue snapshot includes viewport-specific inline offsets.
      // The CSS layer also normalizes these before hydration and without JS.
      slide.style.removeProperty('transform');
      slide.classList.remove('is-animating');
      slide.id ||= `opc-hero-panel-${index + 1}`;
      slide.setAttribute('role', 'tabpanel');
      const button = document.createElement('button');
      button.type = 'button';
      button.id = `opc-hero-tab-${index + 1}`;
      button.className = 'opc-carousel-dot';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-label', `第 ${index + 1} 张主视觉`);
      button.setAttribute('aria-controls', slide.id);
      slide.setAttribute('aria-labelledby', button.id);
      dots.append(button);
      return button;
    });
    container.append(dots);
    // Keep controls above the overlay, outside the slides' stacking context.
    hero.append(container);
    cleanup.push(() => container.remove());
    let current = 0;
    let timer: number | undefined;
    let hovered = false;
    let focused = hero.contains(document.activeElement);
    let touching = false;
    let preloadFor = -1;
    let preloadTimer: number | undefined;
    let cancelImageWait = () => {};
    let preloadGeneration = 0;
    const images = slides.map(slide => slide.querySelector<HTMLImageElement>('img'));
    images.forEach(image => { if (image) remember(image, ['loading']); });

    const cancelPreload = () => {
      preloadGeneration++;
      preloadFor = -1;
      cancelImageWait();
      cancelImageWait = () => {};
      if (preloadTimer !== undefined) window.clearTimeout(preloadTimer);
      preloadTimer = undefined;
    };
    // Let the visible image finish decoding before warming the next frame.
    // Initial enhancement must not promote a second large image ahead of LCP.
    const warmNextImage = () => {
      if (preloadFor === current) return;
      cancelPreload();
      const image = images[current];
      if (!image) return;
      preloadFor = current;
      const generation = preloadGeneration;
      const ready = async () => {
        cancelImageWait();
        cancelImageWait = () => {};
        try { await image.decode(); } catch { /* A failed image must not block navigation. */ }
        if (!alive || generation !== preloadGeneration) return;
        preloadTimer = window.setTimeout(() => {
          preloadTimer = undefined;
          if (!alive || generation !== preloadGeneration || document.hidden || !carouselVisible || reduced) return;
          const nextImage = images[(current + 1) % images.length];
          if (nextImage) nextImage.loading = 'eager';
        }, 1000);
      };
      if (image.complete) void ready();
      else {
        const onReady = () => { void ready(); };
        image.addEventListener('load', onReady, { once: true });
        image.addEventListener('error', onReady, { once: true });
        cancelImageWait = () => {
          image.removeEventListener('load', onReady);
          image.removeEventListener('error', onReady);
        };
      }
    };
    cleanup.push(cancelPreload);

    const show = (index: number) => {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, position) => {
        const active = position === current;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', String(!active));
        slide.inert = !active;
        buttons[position].classList.toggle('is-active', active);
        buttons[position].setAttribute('aria-selected', String(active));
        buttons[position].tabIndex = active ? 0 : -1;
      });
      carousel.dataset.opcSlide = String(current + 1);
      const activeImage = images[current];
      if (activeImage) activeImage.loading = 'eager';
    };
    const stop = () => {
      if (timer !== undefined) { window.clearTimeout(timer); timer = undefined; }
    };
    const reasons = () => [
      document.hidden && 'background', !carouselVisible && 'offscreen', reduced && 'reduced-motion',
      hovered && 'hover', focused && 'focus', touching && 'touch',
    ].filter(Boolean) as string[];
    const sync = () => {
      stop();
      const paused = reasons();
      carousel.dataset.opcAutoplay = String(paused.length === 0);
      carousel.dataset.opcPauseReason = paused.join(',');
      if (document.hidden || !carouselVisible || reduced) cancelPreload();
      else warmNextImage();
      if (!alive || paused.length) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        if (alive && !reasons().length) show(current + 1);
        if (alive) sync();
      }, PERIOD);
    };
    reconcileCarousel = sync;
    cleanup.push(stop);
    buttons.forEach((button, index) => listen(button, 'click', () => { show(index); sync(); }));
    listen(dots, 'keydown', event => {
      const keyboard = event as KeyboardEvent;
      const position = buttons.indexOf(event.target as HTMLButtonElement);
      if (position < 0) return;
      const next = keyboard.key === 'ArrowRight' ? position + 1 : keyboard.key === 'ArrowLeft' ? position - 1
        : keyboard.key === 'Home' ? 0 : keyboard.key === 'End' ? buttons.length - 1 : null;
      if (next === null) return;
      keyboard.preventDefault();
      show(next);
      buttons[current].focus({ preventScroll: true });
      sync();
    });
    listen(hero, 'pointerenter', event => {
      if ((event as PointerEvent).pointerType === 'mouse') { hovered = true; sync(); }
    });
    listen(hero, 'pointerleave', () => { hovered = false; sync(); });
    listen(hero, 'focusin', () => { focused = true; sync(); });
    listen(hero, 'focusout', event => {
      focused = (event as FocusEvent).relatedTarget instanceof Node && hero.contains((event as FocusEvent).relatedTarget as Node);
      sync();
    });
    let touchX = 0;
    let touchY = 0;
    listen(hero, 'touchstart', event => {
      const touch = (event as TouchEvent).touches[0];
      touchX = touch?.clientX ?? 0; touchY = touch?.clientY ?? 0;
      touching = true; sync();
    }, { passive: true });
    listen(hero, 'touchend', event => {
      const touch = (event as TouchEvent).changedTouches[0];
      const delta = (touch?.clientX ?? touchX) - touchX;
      if (Math.abs(delta) > 40 && Math.abs(delta) > Math.abs((touch?.clientY ?? touchY) - touchY)) show(current + (delta < 0 ? 1 : -1));
      touching = false; sync();
    }, { passive: true });
    listen(hero, 'touchcancel', () => { touching = false; sync(); }, { passive: true });
    listen(document, 'visibilitychange', sync);
    listen(preference, 'change', () => { reduced = preference.matches; sync(); });
    if (!regionObserver) {
      const updateVisibility = () => { carouselVisible = inViewport(hero); sync(); };
      listen(window, 'scroll', updateVisibility, { passive: true });
      listen(window, 'resize', updateVisibility);
    }
    show(0);
    sync();
  }

  return () => {
    alive = false;
    cleanup.reverse().forEach(dispose => dispose());
  };
}
