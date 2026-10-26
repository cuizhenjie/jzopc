/**
 * Scroll-linked depth for captured OPC pages.
 *
 * Only decorative/media layers move. Copy, controls and reading order stay in
 * the document flow. The media query is deliberately desktop-only: mobile and
 * reduced-motion users get the static, fully readable composition instead.
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const DESKTOP_MOTION = '(min-width: 1024px) and (prefers-reduced-motion: no-preference)';

export function mountParallaxMotion(root: HTMLElement): () => void {
  const context = gsap.context(() => {
    const media = gsap.matchMedia();
    media.add(DESKTOP_MOTION, () => {
      const marked: HTMLElement[] = [];
      const select = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
      const mark = (element: HTMLElement, name: string) => {
        element.dataset.opcParallax = name;
        marked.push(element);
      };
      const trigger = (element: HTMLElement, start = 'top bottom', end = 'bottom top') => ({
        trigger: element,
        start,
        end,
        scrub: true,
        invalidateOnRefresh: true,
      });
      const drift = (
        elements: HTMLElement[],
        triggerElement: HTMLElement,
        name: string,
        from: number,
        to: number,
        scale?: number,
        start?: string,
        end?: string,
      ) => {
        if (!elements.length) return;
        elements.forEach(element => mark(element, name));
        gsap.set(elements, { willChange: 'transform', ...(scale ? { scale, transformOrigin: '50% 50%' } : {}) });
        gsap.fromTo(elements, { yPercent: from }, {
          yPercent: to,
          ease: 'none',
          scrollTrigger: trigger(triggerElement, start, end),
        });
      };

      // Home hero: only the image travels against the viewport. The original
      // copy entrance animation keeps ownership of the text layer, so scrolling
      // never competes with typography or fades the reading content.
      const hero = root.querySelector<HTMLElement>('.hero');
      if (hero) {
        const images = select('.hero .hero-carousel-img img');
        drift(images, hero, 'hero-background', -4, 10, 1.08, 'top top', 'bottom top');
      }

      // Shared interior mastheads use the same motion language as the home
      // banner, with a smaller range to keep the search/forms visually calm.
      select('.opc-visual-hero').forEach(element => {
        const art = element.querySelector<HTMLElement>('.opc-visual-hero-image');
        if (art) drift([art], element, 'interior-hero-art', -5, 8, 1.08);
      });

      // The dark About band is a second depth cue on the home page. Scale the
      // absolute layer first so its travel never exposes an empty edge.
      const about = root.querySelector<HTMLElement>('.about-sec');
      const aboutBackground = about?.querySelector<HTMLElement>('.about-bg-img');
      if (about && aboutBackground) drift([aboutBackground], about, 'about-background', -8, 8, 1.12);

      // Existing decorative grids/dots add continuity between sections without
      // moving any text or card hit areas.
      const featureSection = root.querySelector<HTMLElement>('.features-sec');
      const featureDots = featureSection?.querySelector<HTMLElement>('.ftr-bg-dots');
      if (featureSection && featureDots) drift([featureDots], featureSection, 'feature-grid', -8, 8);
      const ecosystem = root.querySelector<HTMLElement>('.eco-sec');
      const ecosystemGrid = ecosystem?.querySelector<HTMLElement>('.eco-bg-grid');
      if (ecosystem && ecosystemGrid) drift([ecosystemGrid], ecosystem, 'ecosystem-grid', -6, 6);
      const cta = root.querySelector<HTMLElement>('.cta-sec');
      const ctaGrid = cta?.querySelector<HTMLElement>('.cta-dot-grid');
      if (cta && ctaGrid) drift([ctaGrid], cta, 'cta-decoration', -12, 12);

      // Photography gets a restrained independent depth cue. The fixed media
      // frame remains stationary; only the image inside it moves.
      select('.opc-visual-photo-card').forEach(card => {
        const image = card.querySelector<HTMLElement>('.opc-visual-photo-media img');
        if (image) drift([image], card, 'gallery-image', -4, 4, 1.06);
      });

      return () => marked.forEach(element => element.removeAttribute('data-opc-parallax'));
    }, root);
    return () => media.revert();
  }, root);

  return () => context.revert();
}
