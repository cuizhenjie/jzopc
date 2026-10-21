/** Safeguards for the SSR poster, strict WebGL2 support and scene lifecycle. */
import { test, describe, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectWebGL2, profileDevice } from '@/components/three/quality';
import { observeSceneActivity } from '@/components/three/useSceneActivity';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');
const heroSceneSrc = read('src/components/three/HeroScene.tsx');
const runtimeSrc = read('src/components/three/HeroSceneRuntime.tsx');
const heroSrc = read('src/components/sections/Hero.tsx');
const shaderCanvasSrc = read('src/components/three/ShaderCanvas.tsx');

function replaceGlobal(context: TestContext, name: string, value: unknown) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  context.after(() => {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  });
}

function browserProfile(context: TestContext, options: { webgl2: boolean; webgl1?: boolean; reduced?: boolean; mobile?: boolean }) {
  const requests: string[] = [];
  let released = 0;
  replaceGlobal(context, 'document', {
    createElement: () => ({
      getContext: (name: string) => {
        requests.push(name);
        const supported = name === 'webgl2' ? options.webgl2 : options.webgl1;
        return supported ? { getExtension: () => ({ loseContext: () => { released += 1; } }) } : null;
      },
    }),
  });
  replaceGlobal(context, 'navigator', { deviceMemory: 8, userAgent: options.mobile ? 'iPhone Mobile' : 'Desktop' });
  replaceGlobal(context, 'window', { devicePixelRatio: 3, matchMedia: () => ({ matches: Boolean(options.reduced) }) });
  return { requests, released: () => released };
}

describe('3D capability and resource handling', () => {
  test('WebGL1-only is static, so unsupported renderers are never mounted', (context) => {
    const probe = browserProfile(context, { webgl2: false, webgl1: true });
    const profile = profileDevice();
    assert.equal(profile.hasWebGL2, false);
    assert.equal(profile.hasWebGL1, true);
    assert.equal(profile.tier, 'static');
    assert.equal(profile.particleCount, 0);
    assert.deepEqual(probe.requests, ['webgl2', 'webgl']);
    assert.equal(probe.released(), 1, 'The diagnostic WebGL1 context must be released');
  });

  test('WebGL2 probing releases the temporary context and needs no WebGL1 probe', (context) => {
    const probe = browserProfile(context, { webgl2: true });
    const profile = profileDevice();
    assert.equal(profile.tier, 'high');
    assert.deepEqual(probe.requests, ['webgl2']);
    assert.equal(probe.released(), 1);
    assert.deepEqual(profile.dpr, [1, 1.5]);
  });

  test('Mobile DPR remains capped at 1.25 and reduced motion selects a static poster', (context) => {
    browserProfile(context, { webgl2: true, reduced: true, mobile: true });
    const profile = profileDevice();
    assert.equal(profile.tier, 'static');
    assert.equal(profile.particleCount, 0);
    assert.deepEqual(profile.dpr, [1, 1.25]);
  });

  test('A failed context probe degrades safely', (context) => {
    replaceGlobal(context, 'document', { createElement: () => { throw new Error('Blocked'); } });
    assert.equal(detectWebGL2(), false);
  });
});

describe('Scene activity lifecycle', () => {
  test('Offscreen, background and return-to-foreground transitions remain independent', (context) => {
    let visibility = 'visible';
    const documentTarget = new EventTarget();
    Object.defineProperty(documentTarget, 'visibilityState', { get: () => visibility });
    replaceGlobal(context, 'document', documentTarget);
    let notify: IntersectionObserverCallback | undefined;
    let observed: unknown;
    let disconnected = false;
    replaceGlobal(context, 'IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { notify = callback; }
      observe(element: unknown) { observed = element; }
      disconnect() { disconnected = true; }
    });
    const shell = {} as HTMLElement;
    const states: boolean[] = [];
    const stop = observeSceneActivity(shell, (value) => states.push(value));
    const intersect = (isIntersecting: boolean) => notify?.([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
    assert.equal(observed, shell, 'The poster shell must be observed before a Canvas exists');
    assert.equal(states.at(-1), false);
    intersect(true);
    assert.equal(states.at(-1), true);
    visibility = 'hidden';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    assert.equal(states.at(-1), false);
    intersect(false);
    visibility = 'visible';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    assert.equal(states.at(-1), false, 'Foreground must not restart an offscreen scene');
    intersect(true);
    assert.equal(states.at(-1), true);
    stop();
    const afterStop = states.length;
    visibility = 'hidden';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    assert.equal(states.length, afterStop, 'The visibility listener must be removed on teardown');
    assert.equal(disconnected, true);
  });

  test('Without IntersectionObserver, visibility still pauses the scene', (context) => {
    replaceGlobal(context, 'IntersectionObserver', undefined);
    const documentTarget = new EventTarget();
    Object.defineProperty(documentTarget, 'visibilityState', { value: 'visible' });
    replaceGlobal(context, 'document', documentTarget);
    const states: boolean[] = [];
    const stop = observeSceneActivity({} as HTMLElement, (value) => states.push(value));
    assert.deepEqual(states, [true]);
    stop();
  });
});

describe('SSR, loading and GPU ownership contracts', () => {
  test('The SSR poster exists outside the lazy 3D boundary', () => {
    assert.match(heroSrc, /HeroScene/);
    assert.doesNotMatch(heroSrc, /import\([^)]*HeroScene[^)]*\)\s*,\s*\{\s*ssr:\s*false/);
    assert.match(heroSceneSrc, /<StaticNebula/);
    assert.match(heroSceneSrc, /enabled && profile/);
    assert.match(heroSceneSrc, /dynamic\(\(\) => import\('\.\/HeroSceneRuntime'\), \{ ssr: false \}\)/);
    assert.doesNotMatch(heroSceneSrc, /from ['"](?:three|@react-three|@paper-design)/);
    assert.match(heroSceneSrc, /requestIdleCallback/);
    assert.match(heroSceneSrc, /readyState === 'complete'/);
  });

  test('Error boundaries protect the content and return the scene to its poster', () => {
    assert.ok(existsSync(resolve(repoRoot, 'src/components/three/ThreeErrorBoundary.tsx')));
    const boundary = read('src/components/three/ThreeErrorBoundary.tsx');
    assert.match(boundary, /getDerivedStateFromError/);
    assert.match(boundary, /this\.props\.fallback/);
    assert.match(boundary, /this\.props\.onFailure\?\.\(\)/);
    assert.match(heroSrc, /ThreeErrorBoundary/);
    assert.match(heroSceneSrc, /ThreeErrorBoundary/);
    assert.match(shaderCanvasSrc, /addEventListener\('webglcontextlost'/);
    assert.match(shaderCanvasSrc, /removeEventListener\('webglcontextlost'/);
    assert.match(shaderCanvasSrc, /gl\.debug\.onShaderError = \(\) => onContextLost\(\)/);
  });

  test('The static artwork has no runtime or 3D dependency', () => {
    const source = read('src/components/three/StaticNebula.tsx');
    assert.doesNotMatch(source, /from 'three'|@react-three|@paper-design|useEffect|useState/);
    assert.match(source, /data-scene-poster="true"/);
    const css = read('src/components/three/StaticNebula.module.css');
    assert.match(css, /radial-gradient/);
    assert.match(css, /border-radius: 50%/);
  });

  test('Only one Canvas is used, sharing device DPR and scene activity', () => {
    assert.equal((shaderCanvasSrc.match(/<Canvas\b/g) ?? []).length, 1);
    assert.match(shaderCanvasSrc, /dpr=\{profile\.dpr\}/);
    assert.match(shaderCanvasSrc, /frameloop=\{active \? 'always' : 'never'\}/);
    assert.doesNotMatch(shaderCanvasSrc, /profileDevice\(/);
    assert.match(runtimeSrc, /useAdaptiveQuality\(profile\.particleCount, active\)/);
    assert.doesNotMatch(read('src/components/three/HeroBackdrop.tsx'), /@paper-design/);
    assert.match(read('src/components/three/quality.ts'), /baseCount <= 0 \|\| !active/);
  });

  test('Primitive geometry is released when the quality changes or scene unmounts', () => {
    const nebula = read('src/components/three/HeroNebula.tsx');
    assert.match(nebula, /<primitive\s+object=\{geometry\}/);
    assert.match(nebula, /useEffect\(\(\) => \(\) => geometry\.dispose\(\), \[geometry\]\)/);
    assert.doesNotMatch(nebula, /state\.scene\.rotation/);
  });

  test('Diagnostics reflect actual frames and runtime motion preferences can stop 3D', () => {
    assert.match(shaderCanvasSrc, /useFrame/);
    assert.match(shaderCanvasSrc, /dataset\.renderFrames/);
    for (const marker of ['data-3d-tier=', 'data-3d-particles=', 'data-scene-active=']) {
      assert.ok(heroSceneSrc.includes(marker));
    }
    assert.match(heroSceneSrc, /motionQuery\.addEventListener\('change'/);
    assert.match(heroSceneSrc, /motionQuery\.removeEventListener\('change'/);
    assert.doesNotMatch(heroSceneSrc, /setPointer\(/);
  });
});
