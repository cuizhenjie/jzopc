import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { getReplicaPage } from '@/lib/opc/content';
import { publicNavigation } from '@/lib/site/navigation';

type Variant = { url: string; width: number; height: number; bytes: number; sha256: string };
type Asset = { id: string; source: string; sourceType: string; tool?: string; kind: string; alt: string; slots: string[]; original: { sha256: string; width: number; height: number; bytes: number }; variants: Variant[] };
const manifest = JSON.parse(readFileSync('scripts/opc-source/visual-media.json', 'utf8')) as { assets: Asset[] };
const variants = new Map(manifest.assets.flatMap(asset => asset.variants.map(variant => [variant.url, variant] as const)));

test('icon and media generation reject symlinked output ancestors before creating or writing outside a temporary repository', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'opc-media-symlink-'));
  const initialManifest = JSON.stringify({ schemaVersion: 1, assets: [] });
  const fixture = (name: string) => {
    const root = join(temporary, name);
    mkdirSync(join(root, 'scripts/opc-source'), { recursive: true });
    copyFileSync('scripts/build-opc-visual-media.mjs', join(root, 'scripts/build-opc-visual-media.mjs'));
    copyFileSync('scripts/build-opc-icons.mjs', join(root, 'scripts/build-opc-icons.mjs'));
    writeFileSync(join(root, 'scripts/opc-source/visual-media.json'), initialManifest);
    symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
    return root;
  };
  try {
    for (const [index, target] of ['public', 'public/opc', 'public/opc/visual'].entries()) {
      const root = fixture(`reject-${index}`);
      const outside = join(temporary, `outside-${index}`);
      mkdirSync(outside);
      mkdirSync(dirname(join(root, target)), { recursive: true });
      symlinkSync(outside, join(root, target), 'dir');
      assert.throws(() => execFileSync('node', [join(root, 'scripts/build-opc-icons.mjs')], { encoding: 'utf8', stdio: 'pipe' }), /canonical repository directory/);
      assert.throws(() => execFileSync('node', [join(root, 'scripts/build-opc-visual-media.mjs')], { encoding: 'utf8', stdio: 'pipe' }), /canonical repository directory/);
      assert.deepEqual(readdirSync(outside), [], `${target}: no directory or file may be created through the symlink`);
      assert.equal(readFileSync(join(root, 'scripts/opc-source/visual-media.json'), 'utf8'), initialManifest);
    }
    const root = fixture('create-missing-directories');
    assert.match(execFileSync('node', [join(root, 'scripts/build-opc-visual-media.mjs')], { encoding: 'utf8' }), /Built 0 visual sources \/ 0 local variants/);
    assert.deepEqual(readdirSync(join(root, 'public/opc/visual')), []);
    assert.match(execFileSync('node', [join(root, 'scripts/build-opc-icons.mjs')], { encoding: 'utf8' }), /Generated 8 service icons/);
    const icons = readdirSync(join(root, 'public/opc/visual'));
    assert.equal(icons.length, 8);
    for (const icon of icons) assert.deepEqual(readFileSync(join(root, 'public/opc/visual', icon)), readFileSync(join('public/opc/visual', icon)));
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('all provided media are inventoried and derivatives match their audited dimensions and hashes', () => {
  const sources: string[] = [];
  function visit(folder: string) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.(png|jpe?g|webp)$/i.test(entry.name)) sources.push(path);
    }
  }
  visit('webimages');
  assert.equal(sources.length, 36);
  assert.deepEqual(manifest.assets.filter(asset => asset.sourceType === 'user-provided').map(asset => asset.source).sort(), sources.sort());
  assert.equal(manifest.assets.length, 66);
  assert.equal(variants.size, 70);
  for (const asset of manifest.assets) {
    assert.ok(asset.slots.length, asset.id);
    assert.match(asset.original.sha256, /^[a-f\d]{64}$/);
    for (const variant of asset.variants) {
      assert.match(variant.url, /^\/opc\/visual\/[a-z\d-]+\.(?:webp|svg)$/);
      const bytes = readFileSync(`public${variant.url}`);
      assert.equal(bytes.length, variant.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), variant.sha256);
      assert.ok(variant.width <= asset.original.width && variant.height <= asset.original.height);
    }
  }
  const banner = manifest.assets.find(asset => asset.id === 'computing-banner')!;
  assert.equal(banner.sourceType, 'generated');
  assert.equal(banner.tool, 'image_gen');
  assert.match(execFileSync('node', ['scripts/build-opc-visual-media.mjs', '--check'], { encoding: 'utf8' }), /Verified 66 visual sources \/ 70 local variants/);
});

test('homepage carousel uses four responsive local images with a single high priority frame', () => {
  const home = getReplicaPage('/')!.html;
  const slides = [...home.matchAll(/<img\b[^>]*src="(\/opc\/visual\/(?:hero-city-\d+|computing-banner)-1920.webp)"[^>]*>/g)].map(match => match[0]);
  assert.equal(slides.length, 4);
  const order = ['computing-banner', 'hero-city-12', 'hero-city-11', 'hero-city-13'];
  assert.deepEqual(slides.map(slide => slide.match(/src="([^"]+)"/)![1]), order.map(name => `/opc/visual/${name}-1920.webp`));
  for (const [index, id] of order.entries()) {
    assert.ok(manifest.assets.find(asset => asset.id === id)!.slots.includes(`home.hero.${index + 1}`));
  }
  assert.equal(slides.filter(slide => slide.includes('fetchpriority="high"')).length, 1);
  assert.match(slides[0], /fetchpriority="high"/);
  assert.match(slides[0], /loading="eager"/);
  for (const slide of slides.slice(1)) {
    assert.match(slide, /loading="lazy"/);
    assert.match(slide, /fetchpriority="auto"/);
  }
  for (const slide of slides) {
    assert.match(slide, /alt=""/);
    assert.match(slide, /width="1920"/);
    const set = slide.match(/srcset="([^"]+)"/)![1];
    for (const candidate of set.split(', ')) {
      const [url, width] = candidate.split(' ');
      assert.equal(variants.get(url)?.width, parseInt(width));
    }
  }
  const fullHeroBytes = ['hero-city-12', 'hero-city-11', 'hero-city-13'].reduce((sum, id) => sum + manifest.assets.find(asset => asset.id === id)!.variants.at(-1)!.bytes, 0);
  assert.ok(fullHeroBytes < 400_000);
  const actions = home.match(/<div class="opc-home-actions">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(actions, 'homepage shortcuts are present in the server-rendered HTML');
  assert.match(actions, /href="\/agent">探索智能体<\/a>/);
  assert.match(actions, /href="\/apply">申请入驻<\/a>/);
  assert.equal([...home.matchAll(/class="opc-home-actions"/g)].length, 1);
  assert.equal([...home.matchAll(/class="hero-stat"/g)].length, 4);
});

test('homepage about background uses the provided blue city image as a decorative replacement', () => {
  const home = getReplicaPage('/')!.html;
  const asset = manifest.assets.find(asset => asset.id === 'reference-city-blue')!;
  assert.ok(asset.slots.includes('home.about.background'));
  assert.equal(asset.source, 'webimages/大图参考素材/u=2420042102,3108515115&fm=253&fmt=auto&app=138&f=JPEG.webp');
  const images = [...home.matchAll(/<div\b[^>]*class="[^\"]*\babout-bg-el\b[^\"]*"[^>]*>\s*(<img\b[^>]*>)/g)];
  assert.equal(images.length, 1);
  const image = images[0][1];
  assert.match(image, /src="\/opc\/visual\/reference-city-blue.webp"/);
  assert.match(image, /class="el-image__inner"/);
  assert.match(image, /width="915"/);
  assert.match(image, /height="500"/);
  assert.match(image, /alt=""/);
  assert.match(image, /loading="lazy"/);
  assert.match(image, /decoding="async"/);
  assert.doesNotMatch(image, /srcset=|sizes=/);
  assert.match(home, /class="about-bg-img"[^>]*aria-hidden="true"/);
  assert.ok(!home.includes('/opc/assets/4d1f526a0478fe30.webp'));
  assert.equal([...home.matchAll(/fetchpriority="high"/g)].length, 1);
});

test('captured public pages defer navigation to the shared React header', () => {
  const compute = publicNavigation.flatMap(item => item.children ?? [])
    .find(item => item.label === '算力超市');
  assert.equal(compute?.href, '/empower/compute');
  for (const path of ['/', '/agent', '/market', '/center', '/community', '/work', '/about']) {
    const html = getReplicaPage(path)!.html;
    assert.doesNotMatch(html, /class="[^"]*\b(?:opcheader|nav-links|mobile-menu)\b/, path);
  }
  // 首页特性卡的算力超市入口保持外部直达（th.jimei.cn，新窗口打开）。
  const feature = [...getReplicaPage('/')!.html.matchAll(/<a\b([^>]*class="ftr-node[^>]*)>([\s\S]*?)<\/a>/g)]
    .find(match => match[2].includes('算力超市'))!;
  assert.match(feature[1], /href="https:\/\/th\.jimei\.cn"/);
  assert.match(feature[1], /target="_blank"/);
  assert.match(feature[1], /rel="noopener noreferrer"/);
});

test('learning and overview photos are independent of factual articles; cooperative enterprises keep sixteen entries', () => {
  const home = getReplicaPage('/')!.html;
  const gallery = home.match(/<section\b[^>]*data-opc-gallery="learning"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(gallery);
  assert.equal([...gallery.matchAll(/<figure\b/g)].length, 6);
  assert.match(gallery, /学习与交流/);
  const academy = getReplicaPage('/center')!.html.match(/<section\b[^>]*data-opc-gallery="academy"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.equal([...academy!.matchAll(/<figure\b/g)].length, 3);
  assert.match(getReplicaPage('/community')!.html, /data-opc-gallery="scene"/);
  const overview = getReplicaPage('/about')!.html.match(/<figure class="opc-about-overview-media">([\s\S]*?)<\/figure>/)?.[1];
  assert.ok(overview);
  assert.match(overview, /src="\/opc\/visual\/reference-city-window\.webp"/);
  assert.match(overview, /<figcaption>连接城市与产业，让 AI 创业在此生长<\/figcaption>/);
  for (const path of ['/', '/work']) {
    const html = getReplicaPage(path)!.html;
    // 2026-10-23 契约 docs/15 §2.Req6：AI生态 logo 墙重写为「合作企业」
    // 16 家文字卡（无图资产；logo-01..12 不再被页面引用，manifest 保留）。
    const grid = html.match(/<ul\b[^>]*opc-visual-partner-grid[^>]*>([\s\S]*?)<\/ul>/)?.[1];
    assert.ok(grid, path);
    assert.equal([...grid.matchAll(/<li\b[^>]*opc-visual-partner-card/g)].length, 16, path);
    assert.match(html, /合作企业/);
    assert.ok(!/\/opc\/visual\/logo-\d+\.webp/.test(html), path);
  }
  const icons = [...home.matchAll(/<img\b[^>]*class="opc-visual-service-icon"[^>]*>/g)];
  assert.equal(icons.length, 7); // GPU资源特性卡已下线，服务图标 8→7
  assert.ok(icons.every(icon => icon[0].includes('alt=""')));
});

test('compiler only preserves verified srcset paths and never turns a missing local visual into a remote request', () => {
  const script = `import importlib.util,sys\ns=importlib.util.spec_from_file_location('opc','scripts/build-opc-content.py')\nm=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)\nm.load_visual_media()\nassert m.safe_url('/opc/visual/absent.webp', media=True)==''\nassert m.safe_url('/opc/visual/hero-city-12-960.webp?x=1', media=True)==''\nassert m.safe_srcset('https://evil.test/a.webp 960w')==''\nassert m.safe_srcset('/opc/visual/hero-city-12-960.webp 1920w')==''\nassert m.safe_srcset('/opc/visual/hero-city-12-960.webp 960w, /opc/visual/hero-city-12-960.webp 960w')==''\nassert m.safe_srcset('/opc/visual/hero-city-12-960.webp 960w')\nprint('precise visual media checks passed')`;
  assert.match(execFileSync('python3', ['-c', script], { encoding: 'utf8' }), /precise visual media checks passed/);
});
