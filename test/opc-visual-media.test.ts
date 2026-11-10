/**
 * 参考站素材管线的契约测试。
 *
 * ── 2026-11-10 全站复刻后，素材管线整体换轨 ────────────────────────────
 *
 * 旧管线（旧站素材，**已下线**）：
 *   scripts/opc-source/visual-media.json   素材清单（66 个源 / 70 个本地变体）
 *   scripts/build-opc-visual-media.mjs     生成 webp 变体
 *   scripts/build-opc-icons.mjs             生成工具图标
 *   scripts/build-opc-content.py            编译 HTML + safe_url / safe_srcset 净化
 *   public/opc/visual/*、public/opc/assets/*  旧站运行时素材
 *   src/lib/opc/generated/{details,zone-cities,directory,listings,list-cards}.json
 *
 * 新管线（参考站素材）：
 *   scripts/opc-reference/assets/img/*      参考站图片原件（事实源）
 *   scripts/opc-reference/assets/css/main.css 参考站样式原件
 *   scripts/opc-reference/pages/*.html      参考站页面原件（10 个）
 *   scripts/build-opc-reference.mjs          编译 → generated/pages.json + public/opc/reference/*
 *
 * 删除的旧断言（逐条说明）：
 *   - 「visual-media.json 的 66 源 / 70 变体清单与 sha256」
 *     → 旧站素材管线已下线，素材清单不再是事实源；
 *   - 「build-opc-visual-media.mjs / build-opc-icons.mjs 的符号链接防护」
 *     → 这两个脚本属于旧管线，新管线（build-opc-reference.mjs）只做拷贝，
 *       不写用户目录，无符号链接逃逸面；
 *   - 「build-opc-content.py 的 safe_url / safe_srcset 净化自测」
 *     → 净化器已换成 sanitize-html 白名单（在 build-opc-reference.mjs 里）；
 *   - 「首页轮播 4 张本地图 / about 背景图 / 合作企业 16 家」
 *     → 旧站首页结构，已换成参考站首页。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const read = (rel: string) => readFileSync(resolve(repoRoot, rel), 'utf8');

const SOURCE_IMG_DIR = resolve(repoRoot, 'scripts/opc-reference/assets/img');
const RUNTIME_IMG_DIR = resolve(repoRoot, 'public/opc/reference/img');

const pages = JSON.parse(read('src/lib/opc/generated/pages.json')) as Record<string, { html: string }>;
const manifest = JSON.parse(read('src/lib/opc/generated/manifest.json')) as {
  source: string;
  capturedBy: string;
  compiledBy: string;
  routeCount: number;
  images: number;
};

test('参考站图片原件与运行时副本一一对应（文件名集合相同）', () => {
  const source = readdirSync(SOURCE_IMG_DIR).sort();
  const runtime = readdirSync(RUNTIME_IMG_DIR).sort();
  assert.ok(source.length > 0, '参考站图片原件目录为空');
  assert.deepEqual(runtime, source, '运行时素材目录与原件目录不一致');
  assert.equal(manifest.images, source.length, 'manifest 的图片数与实际不符');
});

test('参考站图片逐文件字节一致（原件未被改写）', () => {
  for (const name of readdirSync(SOURCE_IMG_DIR)) {
    const source = readFileSync(join(SOURCE_IMG_DIR, name));
    const runtime = readFileSync(join(RUNTIME_IMG_DIR, name));
    assert.equal(runtime.length, source.length, `${name} 字节数不一致`);
    assert.equal(
      createHash('sha256').update(runtime).digest('hex'),
      createHash('sha256').update(source).digest('hex'),
      `${name} 内容不一致`,
    );
  }
});

test('运行时素材不是空壳（每个文件都有实际内容）', () => {
  for (const name of readdirSync(RUNTIME_IMG_DIR)) {
    const size = statSync(join(RUNTIME_IMG_DIR, name)).size;
    assert.ok(size > 200, `${name} 只有 ${size} 字节，疑似空文件`);
  }
});

test('页面引用的图片全部落在运行时素材目录里，且文件真实存在', () => {
  const referenced = new Set<string>();
  for (const [path, page] of Object.entries(pages)) {
    for (const match of page.html.matchAll(/<img\b[^>]*\ssrc="([^"]+)"/g)) {
      const src = match[1];
      assert.ok(src.startsWith('/opc/reference/img/'), `${path} 的图片不在参考站素材目录：${src}`);
      assert.ok(existsSync(resolve(repoRoot, `public${src}`)), `${path} 引用的图片缺失：${src}`);
      referenced.add(src);
    }
  }
  assert.ok(referenced.size >= 20, `页面引用的图片过少：${referenced.size}`);
  // 引用的图片必须是素材目录的子集（不得引用目录外的东西）
  const available = new Set(readdirSync(RUNTIME_IMG_DIR).map((name) => `/opc/reference/img/${name}`));
  for (const src of referenced) {
    assert.ok(available.has(src), `页面引用了素材目录里没有的文件：${src}`);
  }
});

test('没有任何页面引用旧站素材目录（/opc/assets/ 与 /opc/visual/）', () => {
  for (const [path, page] of Object.entries(pages)) {
    assert.ok(!page.html.includes('/opc/assets/'), `${path} 仍引用 /opc/assets/ 下的旧素材`);
    assert.ok(!page.html.includes('/opc/visual/'), `${path} 仍引用 /opc/visual/ 下的旧素材`);
  }
  // 产物文件本身同样干净
  const raw = read('src/lib/opc/generated/pages.json');
  assert.ok(!raw.includes('/opc/assets/'), 'pages.json 仍引用 /opc/assets/');
  assert.ok(!raw.includes('/opc/visual/'), 'pages.json 仍引用 /opc/visual/');
});

test('参考站样式：原件保持原样，运行时副本被加上 .opc-site 作用域', () => {
  const source = read('scripts/opc-reference/assets/css/main.css');
  const runtime = read('public/opc/reference/main.css');
  assert.ok(source.length > 1000, '参考站样式原件异常');
  assert.ok(runtime.length > source.length, '运行时副本应比原件长（多了作用域前缀）');
  // 原件里没有 .opc-site（它是我们加的）
  assert.ok(!source.includes('.opc-site'), '参考站样式原件不应含 .opc-site 前缀');
  // 运行时副本里全是 .opc-site
  assert.ok(runtime.includes('.opc-site'), '运行时副本应含 .opc-site 前缀');
  // 变量定义从 :root 搬到了作用域根
  assert.match(source, /:root\s*\{/, '原件应有 :root 变量块');
  assert.match(runtime, /\.opc-site\s*\{[^}]*--navy/, '运行时副本应在作用域根定义变量');
});

test('favicon 也被复制到运行时目录', () => {
  assert.ok(existsSync(resolve(repoRoot, 'scripts/opc-reference/assets/img/favicon.svg')));
  assert.ok(existsSync(resolve(repoRoot, 'public/opc/reference/favicon.svg')));
  assert.equal(
    createHash('sha256').update(read('public/opc/reference/favicon.svg')).digest('hex'),
    createHash('sha256').update(read('scripts/opc-reference/assets/img/favicon.svg')).digest('hex'),
    'favicon 副本与原件不一致',
  );
});

test('manifest 记录的是参考站来源与参考站编译管线', () => {
  assert.match(manifest.source, /^https:\/\/jizhi-ai-opc\.app\.workbuddy\.host\//);
  assert.equal(manifest.capturedBy, 'scripts/fetch-opc-reference.mjs');
  assert.equal(manifest.compiledBy, 'scripts/build-opc-reference.mjs');
  assert.equal(manifest.routeCount, Object.keys(pages).length);
});

test('旧素材管线的产物不再被运行期消费', () => {
  // 旧站烘焙产物仍在仓库里（历史遗留），但没有任何运行期源码再引用它们。
  const legacyImports = [
    'generated/details.json',
    'generated/zone-cities.json',
    'generated/directory.json',
    'generated/listings.json',
    'generated/list-cards.json',
  ];
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(resolve(repoRoot, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(rel);
        continue;
      }
      if (!/\.(tsx|ts)$/.test(entry.name)) continue;
      const source = read(rel);
      for (const legacy of legacyImports) {
        if (source.includes(legacy)) offenders.push(`${rel} → ${legacy}`);
      }
    }
  };
  walk('src');
  assert.deepEqual(offenders, [], `运行期仍在消费旧站烘焙产物：\n  ${offenders.join('\n  ')}`);
});

test('运行期只消费新产物（pages.json / article-shell.json / manifest.json）', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(resolve(repoRoot, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(rel);
        continue;
      }
      if (!/\.(tsx|ts)$/.test(entry.name)) continue;
      const source = read(rel);
      if (!source.includes("generated/")) continue;
      for (const match of source.matchAll(/generated\/([a-z-]+)\.json/g)) {
        const file = match[1];
        if (!['pages', 'article-shell', 'manifest'].includes(file)) {
          offenders.push(`${rel} → generated/${file}.json`);
        }
      }
    }
  };
  walk('src');
  assert.deepEqual(offenders, [], `运行期引用了非参考站产物：\n  ${offenders.join('\n  ')}`);
});
