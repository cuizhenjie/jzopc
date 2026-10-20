/**
 * 品牌色板约束：代码里**不得出现手写色值**。
 *
 * ## 为什么需要这条测试
 *
 * 色板必须全部来自 `logo.svg` 实测值（见 `findings.md` 第 6 节），
 * 「不得臆造新色」是本项目的硬约束。但手写一个「看起来更深一点」的青色
 * （`#3d8578`）既不在色板里，**对比度也只有 3.75:1**（AA 要求 4.5:1），
 * 在 11px 的徽章上肉眼也偏灰。
 *
 * 与「浅底可读蓝」的做法一致（见 `docs/06` §2.3）：需要更深的可读色时，
 * **从品牌色板里挑已有条目**，而不是新造一个。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const srcDir = resolve(repoRoot, 'src');
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');

/** logo.svg 实测色板（findings.md 第 6 节） */
const BRAND_PALETTE = new Set([
  '1d7fba', '142f59', '152e56', '172d56', '0e3769',
  '57b6a5', '57b6a6', '1aa8d3', '1fabbe',
  '0968ab', '64c4d9', '4d5153',
]);

function collectFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, out);
    else if (/\.(tsx|ts|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('品牌色板约束', () => {
  const files = collectFiles(srcDir);

  test('组件与样式里不出现手写色值（只能用 var(--color-*) token）', () => {
    // Tailwind 任意值里的 #hex，例如 text-[#3d8578]
    const re = /(?:text|bg|border|from|to|via|shadow|ring|fill|stroke)-\[(#(?:[0-9a-fA-F]{3,8}))\]\b/g;
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const hex = m[2].slice(1).toLowerCase();
        // 允许的例外：色板实测值本身
        if (BRAND_PALETTE.has(hex)) continue;
        offenders.push(`${file.replace(repoRoot + '/', '')} → ${m[1]}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `发现手写色值（不在 logo.svg 实测色板内）：\n  ${offenders.join('\n  ')}\n` +
        '→ 需要更深的可读色时，从品牌色板里挑已有条目（如 --color-brand-blue-deep / --color-brand-navy-3）',
    );
  });

  test('品牌色 token 逐字来自 logo.svg 实测色板', () => {
    const css = readFileSync(resolve(srcDir, 'styles/globals.css'), 'utf8');
    // 只约束「品牌色」类 token；--color-ink* 是中性文字阶梯（logo.svg 只有一个中性灰 #4D5153，
    // 阶梯需要更多层级），不纳入本约束
    const re = /--color-(?:brand|gradient)[a-z0-9-]*:\s*(#[0-9a-fA-F]{3,8})/g;
    const offenders: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(css)) !== null) {
      const hex = m[1].slice(1).toLowerCase();
      if (!BRAND_PALETTE.has(hex)) offenders.push(`${m[0]} → ${hex}`);
    }
    assert.deepEqual(
      offenders,
      [],
      `品牌色 token 不在实测色板内：\n  ${offenders.join('\n  ')}`,
    );
  });

  test('品牌徽记资源存在，且 Header / Footer 都在用它（而非手工色块）', () => {
    for (const p of ['public/logo-mark.svg', 'public/logo-mark-inverse.svg', 'src/app/icon.svg']) {
      assert.ok(existsSync(resolve(repoRoot, p)), `缺少品牌资源 ${p}`);
    }
    // 徽记必须是从 logo.svg 派生的（viewBox 裁切 + 品牌色填充），不是手搓的色块
    const mark = readFileSync(resolve(repoRoot, 'public/logo-mark.svg'), 'utf8');
    assert.match(mark, /viewBox="345\.8 0 1506\.8 1460\.6"/, '徽记的 viewBox 应裁到 logo.svg 的几何部分');
    for (const hex of BRAND_PALETTE) {
      if (['142f59', '152e56', '172d56', '0e3769', '1d7fba', '57b6a5', '1aa8d3'].includes(hex)) {
        assert.ok(
          mark.toLowerCase().includes(hex),
          `徽记应保留品牌色 ${hex}（说明确实派生自 logo.svg）`,
        );
      }
    }
    // Header / Footer 必须引用共享的 BrandMark，而不是各自画一个渐变方块
    const brandMark = read('src/components/ui/BrandMark.tsx');
    assert.match(brandMark, /logo-mark\.svg/);
    assert.match(brandMark, /logo-mark-inverse\.svg/);
    for (const f of ['src/components/layout/Header.tsx', 'src/components/layout/Footer.tsx']) {
      const src = read(f);
      assert.match(src, /BrandMark/, `${f} 应使用 BrandMark 组件`);
      assert.ok(
        !/linear-gradient\(135deg,#0968AB/.test(src),
        `${f} 仍残留手工渐变 logo 色块`,
      );
    }
  });

  test('色板 token 集合与 logo.svg 实际出现的色值一致', () => {
    const svg = readFileSync(resolve(repoRoot, 'logo.svg'), 'utf8');
    const svgHexes = new Set(
      [...svg.matchAll(/#([0-9a-fA-F]{6})\b/g)].map((m) => m[1].toLowerCase()),
    );
    for (const hex of BRAND_PALETTE) {
      assert.ok(svgHexes.has(hex), `色板条目 ${hex} 在 logo.svg 里不存在`);
    }
  });
});
