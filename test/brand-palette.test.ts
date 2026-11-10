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
 *
 * ## 2026-11-10 全站复刻后的口径变化
 *
 * 公开站的视觉真源变成了**参考站**，因此色板有三层：
 *   1. **旧品牌色板**：logo.svg 实测值（后台 / 原生页仍在用）；
 *   2. **中性阶梯**：正文 / 分割线 / 底色的设计中性色；
 *   3. **参考站色板**：参考站样式原件与页面原件里出现的色值
 *      （scripts/opc-reference/assets/css/main.css + assets/js/main.js + pages/*.html），
 *      公开外壳（Header / Footer 的品牌高亮色、/agent 卡片的图标底色等）从这里取值。
 *
 * 删除的旧断言（逐条说明）：
 *   - 「Header / Footer 必须使用 BrandMark 组件」→ 参考站复刻后，公开外壳
 *     改用参考站品牌图 `/opc/reference/img/logo-icon.png`；
 *     `BrandMark.tsx` 仍被**后台侧边栏**使用，只是不再是公开外壳的品牌载体。
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

/** 中性阶梯：logo.svg 只提供一个中性灰，正文/分割线/底色需要更多层级 */
const NEUTRAL = new Set(['1a2333', '4d5153', '5f6878', 'e3e9f2', 'eef4fa', 'f6f9fc', 'ffffff']);

/** 错误提示需保持可读的语义红色；不作为品牌或装饰配色。 */
const SEMANTIC = new Set(['b42318']);

/** 取文件里出现的全部 hex（3~8 位，统一小写）。 */
function hexesOf(file: string): string[] {
  return [...readFileSync(resolve(repoRoot, file), 'utf8').matchAll(/#([0-9a-fA-F]{3,8})\b/g)]
    .map((match) => match[1].toLowerCase());
}

/**
 * 参考站色板：从**参考站原件**（样式表 + 脚本 + 页面）实测得出，
 * 而不是凭印象手写 —— 参考站自己新增一个色，本站的色板就该跟着认。
 */
function referencePalette(): Set<string> {
  const palette = new Set<string>();
  const referenceRoot = resolve(repoRoot, 'scripts/opc-reference');
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(css|js|html)$/i.test(entry.name)) continue;
      const source = readFileSync(full, 'utf8');
      for (const match of source.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
        palette.add(match[1].toLowerCase());
      }
    }
  };
  walk(referenceRoot);
  return palette;
}

const REFERENCE_PALETTE = referencePalette();

/** src/ 下允许出现的全部色值 */
const ALLOWED = new Set([...BRAND_PALETTE, ...NEUTRAL, ...SEMANTIC, ...REFERENCE_PALETTE]);

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

  test('参考站色板实测得出且非空（口径不靠手写）', () => {
    assert.ok(REFERENCE_PALETTE.size > 50, `参考站色板过少：${REFERENCE_PALETTE.size}`);
    // 公开外壳实际在用的两个高亮色必须落在参考站色板里
    assert.ok(REFERENCE_PALETTE.has('3d8bff'), '参考站色板缺少 #3D8BFF（页头 AI 高亮）');
    assert.ok(REFERENCE_PALETTE.has('3fe0f8'), '参考站色板缺少 #3FE0F8（页脚 AI 高亮）');
  });

  test('组件与样式里不出现手写色值（只能用 var(--color-*) token）', () => {
    // Tailwind 任意值里的 #hex，例如 text-[#3d8578]
    const re = /(?:text|bg|border|from|to|via|shadow|ring|fill|stroke)-\[(#(?:[0-9a-fA-F]{3,8}))\]\b/g;
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        const hex = m[2].slice(1).toLowerCase();
        // 允许的例外：品牌色板 ∪ 参考站色板
        if (BRAND_PALETTE.has(hex) || REFERENCE_PALETTE.has(hex)) continue;
        offenders.push(`${file.replace(repoRoot + '/', '')} → ${m[1]}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `发现手写色值（不在色板内）：\n  ${offenders.join('\n  ')}\n` +
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

  test('公开外壳的品牌图是参考站的 logo-icon.png（文件存在，Header / Footer 都用它）', () => {
    const logo = 'public/opc/reference/img/logo-icon.png';
    assert.ok(existsSync(resolve(repoRoot, logo)), `缺少参考站品牌图 ${logo}`);
    for (const file of ['src/components/layout/Header.tsx', 'src/components/layout/Footer.tsx']) {
      const src = read(file);
      assert.ok(src.includes('/opc/reference/img/logo-icon.png'), `${file} 应引用参考站品牌图`);
    }
    // 品牌图必须真实存在且不是空文件
    const bytes = readFileSync(resolve(repoRoot, logo));
    assert.ok(bytes.length > 1000, '参考站品牌图疑似空文件');
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'logo-icon.png 应是真实 PNG');
  });

  test('公开外壳不再使用 BrandMark 组件（后台侧边栏仍可用）', () => {
    for (const file of ['src/components/layout/Header.tsx', 'src/components/layout/Footer.tsx']) {
      const src = read(file);
      assert.ok(!src.includes('BrandMark'), `${file} 不应再使用 BrandMark 组件`);
      assert.ok(!/linear-gradient\(135deg,#0968AB/.test(src), `${file} 仍残留手工渐变 logo 色块`);
    }
    // BrandMark 组件本身还在（后台侧边栏在用），且仍从 logo-mark.svg 派生
    assert.ok(existsSync(resolve(repoRoot, 'src/components/ui/BrandMark.tsx')), 'BrandMark 组件不应被删除');
    const brandMark = read('src/components/ui/BrandMark.tsx');
    assert.match(brandMark, /logo-mark\.svg/);
    assert.match(brandMark, /logo-mark-inverse\.svg/);
  });

  test('全仓 hex 字面量都属于「品牌色板 ∪ 中性阶梯 ∪ 参考站色板」', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      // 去掉注释后再扫，避免把「原 #7b8494 …」这类说明文字算进来
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const m of code.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
        const hex = m[1].toLowerCase();
        if (!ALLOWED.has(hex)) {
          offenders.push(`${file.replace(repoRoot + '/', '')} → ${m[0]}`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `以下色值既不在品牌色板、也不在中性阶梯或参考站色板内：\n  ${offenders.join('\n  ')}`,
    );
  });

  test('参考站样式原件（vendored）只含参考站色板内的色值', () => {
    // public/opc/reference/main.css 是参考站原件 + 编译期作用域前缀，
    // 它允许出现参考站自己的色板，但**不允许**出现色板外的值。
    const offenders: string[] = [];
    for (const hex of hexesOf('public/opc/reference/main.css')) {
      if (!REFERENCE_PALETTE.has(hex)) offenders.push(hex);
    }
    assert.deepEqual(
      offenders,
      [],
      `参考站样式里出现色板外的色值：\n  ${offenders.join('\n  ')}`,
    );
    assert.ok(hexesOf('public/opc/reference/main.css').length > 20, '参考站样式里应有足量色值');
  });

  test('扩展样式（我们自己写的）同样只允许色板内的色值', () => {
    const offenders: string[] = [];
    for (const hex of hexesOf('public/opc/reference/extension.css')) {
      if (!ALLOWED.has(hex)) offenders.push(hex);
    }
    assert.deepEqual(offenders, [], `扩展样式里出现色板外的色值：\n  ${offenders.join('\n  ')}`);
  });

  test('公开外壳的内联高亮色取自参考站色板', () => {
    const header = read('src/components/layout/Header.tsx');
    const footer = read('src/components/layout/Footer.tsx');
    assert.match(header, /#3D8BFF/, '页头 AI 高亮色');
    assert.match(footer, /#3FE0F8/, '页脚 AI 高亮色');
    for (const source of [header, footer]) {
      for (const match of source.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
        const hex = match[1].toLowerCase();
        assert.ok(ALLOWED.has(hex), `公开外壳出现色板外的色值：#${hex}`);
      }
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
