/**
 * 品牌色 token 与 `logo.svg` 实测值的一致性校验。
 *
 * 真值源是仓库根目录的 `logo.svg`（实测色板），不允许出现 logo 里没有的品牌色。
 * 覆盖两处落地：
 * 1. `src/styles/globals.css` 的 `@theme` token；
 * 2. `src/lib/site/config.ts` 的 `brand` 常量（供 canvas / shader / 内联样式使用）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brand } from '@/lib/site/config';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const cssText = readFileSync(resolve(repoRoot, 'src/styles/globals.css'), 'utf8');
const logoText = readFileSync(resolve(repoRoot, 'logo.svg'), 'utf8');

/** logo.svg 里出现的全部色值（小写） */
const logoColors = new Set(
  [...logoText.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()),
);

/** globals.css 里 `--token: #hex` 的声明 */
const cssTokens = new Map<string, string>();
for (const m of cssText.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  cssTokens.set(`--${m[1]}`, m[2].toLowerCase());
}

/**
 * logo.svg 实测的 6 组基准色 → 落地 token。
 * 渐变为一组两个端点，故共 7 个 token。
 */
const CANONICAL: Record<string, string> = {
  '--color-brand-blue': '#1d7fba', // 主蓝
  '--color-brand-navy': '#142f59', // 深藏蓝
  '--color-brand-teal': '#57b6a5', // 青绿
  '--color-brand-cyan': '#1aa8d3', // 亮青
  '--color-gradient-from': '#0968ab', // 渐变起点
  '--color-gradient-to': '#64c4d9', // 渐变终点
  '--color-ink-2': '#4d5153', // 中性灰
};

/**
 * globals.css 里所有「品牌色」token（中性 UI 色不在此列）。
 * 动态识别，后续新增的 --color-brand-* / --color-gradient-* 会自动纳入检查。
 */
const BRAND_TOKENS = [
  ...new Set([
    ...[...cssTokens.keys()].filter((t) => /^--color-(brand|gradient)-/.test(t)),
    '--color-ink-2',
  ]),
].sort();

/** site/config.ts 的 brand 常量 → 期望色值 */
const CANONICAL_BRAND: Record<string, string> = {
  blue: '#1d7fba',
  navy: '#142f59',
  teal: '#57b6a5',
  cyan: '#1aa8d3',
  gradientFrom: '#0968ab',
  gradientTo: '#64c4d9',
  ink: '#4d5153',
};

describe('logo.svg 真值源', () => {
  test('能解析出品牌色', () => {
    assert.ok(logoColors.size > 0, 'logo.svg 里没解析到任何色值');
  });

  test('6 组基准色都确实出现在 logo.svg 中', () => {
    for (const [token, hex] of Object.entries(CANONICAL)) {
      assert.ok(logoColors.has(hex), `${token} 的期望值 ${hex} 在 logo.svg 里不存在`);
    }
  });
});

describe('globals.css 品牌色 token', () => {
  for (const [token, hex] of Object.entries(CANONICAL)) {
    test(`${token} === ${hex}`, () => {
      assert.ok(cssTokens.has(token), `globals.css 缺少 token ${token}`);
      assert.equal(cssTokens.get(token), hex);
    });
  }

  test('每个品牌色 token 的色值都能在 logo.svg 里找到出处', () => {
    for (const token of BRAND_TOKENS) {
      const hex = cssTokens.get(token);
      assert.ok(hex, `globals.css 缺少品牌色 token ${token}`);
      assert.ok(
        logoColors.has(hex!),
        `${token} 的色值 ${hex} 在 logo.svg 里不存在，属于臆造色`,
      );
    }
  });

  test('品牌色 token 没有重复声明（后者会静默覆盖前者）', () => {
    const seen = new Map<string, number>();
    for (const m of cssText.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*#[0-9a-fA-F]{6}\s*;/g)) {
      seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
    }
    for (const [token, count] of seen) {
      assert.equal(count, 1, `token ${token} 被声明了 ${count} 次`);
    }
  });
});

describe('site/config.ts brand 常量', () => {
  for (const [key, hex] of Object.entries(CANONICAL_BRAND)) {
    test(`brand.${key} === ${hex}`, () => {
      const actual = (brand as Record<string, string>)[key];
      assert.equal(typeof actual, 'string', `brand.${key} 不存在`);
      assert.equal(actual.toLowerCase(), hex);
    });
  }

  test('brand 常量里的每个色值都能在 logo.svg 里找到出处', () => {
    for (const [key, value] of Object.entries(brand)) {
      assert.ok(
        logoColors.has(value.toLowerCase()),
        `brand.${key} 的色值 ${value} 在 logo.svg 里不存在，属于臆造色`,
      );
    }
  });

  test('brand 常量与 globals.css 的基准色 token 取值一致', () => {
    const pairs: [string, string][] = [
      ['blue', '--color-brand-blue'],
      ['navy', '--color-brand-navy'],
      ['teal', '--color-brand-teal'],
      ['cyan', '--color-brand-cyan'],
      ['gradientFrom', '--color-gradient-from'],
      ['gradientTo', '--color-gradient-to'],
      ['ink', '--color-ink-2'],
    ];
    for (const [brandKey, token] of pairs) {
      const fromConfig = (brand as Record<string, string>)[brandKey].toLowerCase();
      assert.equal(cssTokens.get(token), fromConfig, `brand.${brandKey} 与 ${token} 不一致`);
    }
  });
});
