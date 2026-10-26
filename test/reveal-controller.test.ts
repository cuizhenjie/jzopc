import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mountReveal } from '@/components/ui/reveal-controller';

class TrackedTarget extends EventTarget {
  listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();

  override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean) {
    super.addEventListener(type, listener, options);
    if (listener) {
      const listeners = this.listeners.get(type) ?? new Set();
      listeners.add(listener);
      this.listeners.set(type, listeners);
    }
  }

  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean) {
    super.removeEventListener(type, listener, options);
    if (listener) this.listeners.get(type)?.delete(listener);
  }
}

class Preference extends TrackedTarget {
  matches = false;
  change(matches: boolean) {
    this.matches = matches;
    this.dispatchEvent(new Event('change'));
  }
  addListener(listener: EventListener) { super.addEventListener('change', listener); }
  removeListener(listener: EventListener) { super.removeEventListener('change', listener); }
}

function createHarness(mode: 'normal' | 'missing' | 'constructor-error' | 'observe-error' | 'synchronous' = 'normal') {
  const preference = new Preference();
  const observers: Observer[] = [];
  const document = { defaultView: null as unknown, activeElement: null as unknown };
  const attributes = new Map<string, string>();
  const styles = new Map<string, { value: string; priority: string }>();
  const element = Object.assign(new TrackedTarget(), {
    top: 1200,
    ownerDocument: document,
    dataset: {} as Record<string, string>,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => { attributes.set(name, value); },
    removeAttribute: (name: string) => { attributes.delete(name); },
    getBoundingClientRect: () => ({ top: element.top }),
    contains: (node: unknown) => node === element,
    style: {
      getPropertyValue: (name: string) => styles.get(name)?.value ?? '',
      getPropertyPriority: (name: string) => styles.get(name)?.priority ?? '',
      setProperty: (name: string, value: string, priority = '') => { styles.set(name, { value, priority }); },
      removeProperty: (name: string) => { styles.delete(name); },
    },
  });
  Object.defineProperty(element.dataset, 'state', {
    get: () => attributes.get('data-state'),
    set: (value: string) => { attributes.set('data-state', value); },
  });

  class Observer {
    disconnected = false;
    callback: IntersectionObserverCallback;
    constructor(callback: IntersectionObserverCallback) {
      if (mode === 'constructor-error') throw new Error('Observer unavailable');
      this.callback = callback;
      observers.push(this);
    }
    observe() {
      if (mode === 'observe-error') throw new Error('Cannot observe');
      if (mode === 'synchronous') this.emit(true);
    }
    disconnect() { this.disconnected = true; }
    emit(isIntersecting: boolean) {
      this.callback([{ target: element, isIntersecting } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver);
    }
  }
  const view = {
    innerHeight: 800,
    matchMedia: (() => preference) as (() => Preference) | undefined,
    IntersectionObserver: mode === 'missing' ? undefined : Observer,
  };
  document.defaultView = view;
  return { element, preference, document, view, observers, mount: (distance?: number) => mountReveal(element as unknown as HTMLElement, distance) };
}

describe('progressive Reveal lifecycle', () => {
  test('content in or near the initial viewport is never prepared as hidden', () => {
    for (const top of [-100, 100, 810, 824]) {
      const h = createHarness();
      assert.equal(h.element.getAttribute('data-state'), null, 'SSR starts visible');
      h.element.top = top;
      const cleanup = h.mount();
      assert.equal(h.element.dataset.state, 'in');
      assert.equal(h.element.getAttribute('data-reveal-immediate'), '');
      assert.equal(h.observers.length, 0);
      cleanup();
    }
  });

  for (const mode of ['missing', 'constructor-error', 'observe-error'] as const) {
    test(`observer ${mode} leaves the content readable`, () => {
      const h = createHarness(mode);
      const cleanup = h.mount();
      assert.equal(h.element.dataset.state, 'in');
      assert.equal(h.element.getAttribute('data-reveal-immediate'), '');
      assert.ok(h.observers.every(observer => observer.disconnected));
      cleanup();
    });
  }

  test('missing or failing motion preference support fails open', () => {
    for (const unavailable of [undefined, () => { throw new Error('Media unsupported'); }]) {
      const h = createHarness();
      h.view.matchMedia = unavailable;
      const cleanup = h.mount();
      assert.equal(h.element.dataset.state, 'in');
      assert.equal(h.observers.length, 0);
      cleanup();
    }
  });

  test('changing to reduced motion reveals pending content and never rearms it', () => {
    const h = createHarness();
    const cleanup = h.mount();
    assert.equal(h.element.dataset.state, 'pending');
    h.preference.change(true);
    assert.equal(h.element.dataset.state, 'in');
    assert.equal(h.element.getAttribute('data-reveal-immediate'), '');
    assert.equal(h.observers[0].disconnected, true);
    h.preference.change(false);
    assert.equal(h.element.dataset.state, 'in');
    assert.equal(h.observers.length, 1);
    cleanup();
  });

  test('initial reduced motion and an existing focus both skip hiding', () => {
    for (const reason of ['reduced', 'focused']) {
      const h = createHarness();
      if (reason === 'reduced') h.preference.matches = true;
      else h.document.activeElement = h.element;
      const cleanup = h.mount();
      assert.equal(h.element.dataset.state, 'in');
      assert.equal(h.observers.length, 0);
      cleanup();
    }
  });

  test('keyboard focus skips pending or running reveal transitions immediately', () => {
    for (const entered of [false, true]) {
      const h = createHarness();
      const cleanup = h.mount();
      if (entered) h.observers[0].emit(true);
      h.element.dispatchEvent(new Event('focusin'));
      assert.equal(h.element.dataset.state, 'in');
      assert.equal(h.element.getAttribute('data-reveal-immediate'), '');
      assert.equal(h.observers[0].disconnected, true);
      cleanup();
    }
  });

  test('a valid intersection reveals once and respects bounded movement', () => {
    const h = createHarness();
    const cleanup = h.mount(100);
    assert.equal(h.element.style.getPropertyValue('--reveal-y'), '24px');
    h.observers[0].emit(false);
    assert.equal(h.element.dataset.state, 'pending');
    h.observers[0].emit(true);
    assert.equal(h.element.dataset.state, 'in');
    assert.equal(h.element.getAttribute('data-reveal-immediate'), null);
    assert.equal(h.observers[0].disconnected, true);
    cleanup();
  });

  test('cleanup restores owned styles and removes listeners across a StrictMode remount', () => {
    const h = createHarness();
    h.element.style.setProperty('--reveal-y', '4px', 'important');
    const firstCleanup = h.mount();
    firstCleanup();
    assert.equal(h.element.getAttribute('data-state'), null);
    assert.equal(h.element.getAttribute('data-reveal-immediate'), null);
    assert.equal(h.element.style.getPropertyValue('--reveal-y'), '4px');
    assert.equal(h.element.style.getPropertyPriority('--reveal-y'), 'important');
    assert.equal(h.element.listeners.get('focusin')?.size, 0);
    assert.equal(h.preference.listeners.get('change')?.size, 0);
    h.observers[0].emit(true);
    assert.equal(h.element.getAttribute('data-state'), null, 'late callbacks cannot mutate an unmounted element');
    const secondCleanup = h.mount();
    assert.equal(h.element.listeners.get('focusin')?.size, 1);
    assert.equal(h.preference.listeners.get('change')?.size, 1);
    assert.equal(h.element.dataset.state, 'pending');
    secondCleanup();
    assert.ok(h.observers.every(observer => observer.disconnected));
  });

  test('a synchronous observer result cannot be overwritten by pending', () => {
    const h = createHarness('synchronous');
    const cleanup = h.mount();
    assert.equal(h.element.dataset.state, 'in');
    cleanup();
  });

  test('legacy preference listeners are removed on cleanup', () => {
    const h = createHarness();
    Object.defineProperty(h.preference, 'addEventListener', { value: undefined });
    const cleanup = h.mount();
    h.preference.change(true);
    assert.equal(h.element.dataset.state, 'in');
    cleanup();
    assert.equal(h.preference.listeners.get('change')?.size, 0);
  });
});
