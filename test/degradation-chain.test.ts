/**
 * 3D 降级链的结构性约束。
 *
 * ## 为什么需要这条测试
 *
 * 2026-10-20 实测发现一个会**打挂整页**的缺陷：在 **WebGL1-only** 设备上，
 * `detectWebGL2()` 把 WebGL1 也判为可用 → 挂载 three →
 * `THREE.WebGLRenderer: Error creating WebGL context.` 未捕获异常沿 React 树冒泡
 * → **整个 Hero 子树被卸载，H1、副标、简介与 CTA 全部消失**。
 *
 * 根因有三处，都需要被锁住：
 *   1. WebGL 探测不严格（把 WebGL1 当可用）；
 *   2. 3D 层没有错误边界，异常会带走内容；
 *   3. `HeroScene` 用 `ssr: false`，导致静态兜底层根本不在服务端 HTML 里。
 *
 * 完整实测证据见 `docs/06-视觉方案与3D动效规范.md` §4.3。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');

const qualitySrc = read('src/components/three/quality.ts');
const heroSceneSrc = read('src/components/three/HeroScene.tsx');
const heroSrc = read('src/components/sections/Hero.tsx');
const shaderCanvasSrc = read('src/components/three/ShaderCanvas.tsx');

describe('3D 降级链 · 结构性约束', () => {
  test('WebGL 探测必须严格：只认 webgl2，不得把 WebGL1 当作可用', () => {
    // 探测函数体内不得出现 `?? getContext('webgl')` 这类回退
    assert.ok(
      !/getContext\('webgl2'\)\s*\?\?\s*\(?canvas\.getContext\('webgl'\)/.test(qualitySrc),
      'detectWebGL2 不得把 WebGL1 作为回退 —— three r163+ 只支持 WebGL2',
    );
    // 必须显式存在 webgl2 的判定
    assert.match(qualitySrc, /getContext\('webgl2'\)/);
    // WebGL1 检测只允许用于诊断，不能参与档位判定
    assert.ok(!/hasWebGL1\s*\?\s*'static'/.test(qualitySrc), 'hasWebGL1 不得参与档位判定');
  });

  test('无 WebGL2 → 静态档', () => {
    assert.match(qualitySrc, /if\s*\(!hasWebGL2\)\s*tier\s*=\s*'static'/);
  });

  test('存在 3D 错误边界，且被 Hero 与 HeroScene 同时使用', () => {
    const boundaryPath = resolve(repoRoot, 'src/components/three/ThreeErrorBoundary.tsx');
    assert.ok(existsSync(boundaryPath), '缺少 src/components/three/ThreeErrorBoundary.tsx');

    const boundarySrc = read('src/components/three/ThreeErrorBoundary.tsx');
    // 必须是真正的错误边界：getDerivedStateFromError + 渲染 fallback
    assert.match(boundarySrc, /getDerivedStateFromError/);
    assert.match(boundarySrc, /this\.props\.fallback/);

    assert.match(heroSrc, /ThreeErrorBoundary/, 'Hero.tsx 必须用错误边界包住 3D 场景');
    assert.match(heroSceneSrc, /ThreeErrorBoundary/, 'HeroScene.tsx 必须用错误边界包住 3D 图层');
  });

  test('HeroScene 允许 SSR —— 静态兜底层必须在服务端 HTML 里', () => {
    // Hero.tsx 对 HeroScene 的动态导入不得是 ssr:false
    const dynImport = /dynamic\(\s*\(\)\s*=>\s*import\('[^']*HeroScene'\)\s*([^)]*)\)/.exec(heroSrc);
    assert.ok(dynImport, 'Hero.tsx 里找不到 HeroScene 的动态导入');
    assert.ok(
      !/ssr\s*:\s*false/.test(dynImport[1] ?? ''),
      'HeroScene 不能用 ssr:false —— 否则静态兜底层不在服务端 HTML，无 JS 时首屏只剩纯色',
    );
    // 但 three / Paper 的子块仍必须是 ssr:false（不进首屏包）
    assert.match(heroSceneSrc, /dynamic\(\(\)\s*=>\s*import\('\.\/HeroNebula'\),\s*\{\s*ssr:\s*false\s*\}\)/);
    assert.match(heroSceneSrc, /dynamic\(\(\)\s*=>\s*import\('\.\/HeroBackdrop'\),\s*\{\s*ssr:\s*false\s*\}\)/);
  });

  test('降级档位与粒子数可被外部读取（逐级留证的前提）', () => {
    assert.match(heroSceneSrc, /data-3d-tier=/, 'HeroScene 必须暴露 data-3d-tier');
    assert.match(heroSceneSrc, /data-3d-particles=/, 'HeroScene 必须暴露 data-3d-particles');
  });

  test('静态兜底组件独立成文件，可被 Hero 静态引用而不打进 three', () => {
    const staticPath = resolve(repoRoot, 'src/components/three/StaticNebula.tsx');
    assert.ok(existsSync(staticPath), '缺少 src/components/three/StaticNebula.tsx');
    const staticSrc = read('src/components/three/StaticNebula.tsx');
    // 不得 import three / paper —— 它必须保持零 3D 依赖
    assert.ok(!/from 'three'|@react-three|@paper-design/.test(staticSrc));
    // 静态渐变与星点必须写死（无 JS 也要有）
    assert.match(staticSrc, /radial-gradient\(120% 90% at 50% 18%/);
  });

  test('ShaderCanvas 在无 WebGL2 时只渲染 fallback，不挂载 Canvas', () => {
    assert.match(shaderCanvasSrc, /if\s*\(!ready\)\s*\{/);
    assert.match(shaderCanvasSrc, /if\s*\(tier\s*===\s*'static'\)\s*\{/);
  });

  test('3D 资源必须被释放：useMemo 建的 geometry 要显式 dispose()', () => {
    const nebulaSrc = read('src/components/three/HeroNebula.tsx');
    // r3f 不会自动释放 <primitive object={...}> 传入的对象
    assert.match(
      nebulaSrc,
      /<primitive\s+object=\{geometry\}/,
      'HeroNebula 用 primitive 挂载 geometry —— r3f 不会自动回收，必须显式 dispose',
    );
    assert.match(
      nebulaSrc,
      /useEffect\(\(\)\s*=>\s*\{\s*return\s*\(\)\s*=>\s*\{\s*geometry\.dispose\(\);/,
      'geometry 必须在变化/卸载时显式 dispose()，否则自适应降档会泄漏 GPU buffer（docs/06 §8 V8）',
    );
  });

  test('3D 视口外必须暂停渲染（frameloop=never）', () => {
    assert.match(shaderCanvasSrc, /IntersectionObserver/);
    assert.match(shaderCanvasSrc, /frameloop:\s*visible\s*\?\s*'always'\s*:\s*'never'/);
  });
});
