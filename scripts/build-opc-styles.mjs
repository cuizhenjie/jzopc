/** Build the isolated reference-site theme and mirror its public image/font assets.
 * Usage: node scripts/build-opc-styles.mjs [capture-directory] [--download]
 * Captures are build inputs only. No original JavaScript is copied or executed.
 */
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';

const project = path.resolve(import.meta.dirname, '..');
const sourceRoot = path.join(project, 'scripts/opc-source');
const input = process.argv.find((value, index) => index > 1 && !value.startsWith('--')) || path.join(sourceRoot, 'styles');
const download = process.argv.includes('--download');
const output = path.join(project, 'public/opc');
const assets = path.join(output, 'assets');
const manifests = sourceRoot;
const prefix = '.opc-replica';
const sourceCss = 'https://opcstore.com/webNew/static/css/';
await fs.mkdir(assets, { recursive: true });
await fs.mkdir(manifests, { recursive: true });
const priorMap = JSON.parse(await fs.readFile(path.join(manifests, 'asset-map.json'), 'utf8').catch(() => '{}'));

const snapshots = JSON.parse(await fs.readFile(path.join(sourceRoot, 'pages.json'), 'utf8'));
if (!snapshots.length) throw new Error('Reference DOM captures are required before generating the stylesheet.');
const dom = snapshots.map((snapshot) => snapshot.html || '').join('\n');
const classes = new Set([...dom.matchAll(/class="([^"]*)"/g)].flatMap((match) => match[1].split(/\s+/)));
const ids = new Set([...dom.matchAll(/\bid="([^"]*)"/g)].map((match) => match[1]));
const dynamicClasses = ['active', 'open', 'is-open', 'is-active', 'is-disabled', 'is-error', 'is-success', 'is-required', 'is-focus', 'is-checked', 'is-loading', 'el-overlay', 'el-dialog', 'el-dialog__body', 'el-dialog__header', 'el-dialog__footer', 'el-message', 'el-message--error', 'el-message--success', 'el-form-item__error', 'el-input__password', 'el-input__suffix', 'el-input__suffix-inner'];
dynamicClasses.forEach((value) => classes.add(value));

/** Transform only the reference orange accent family; error/success colors stay semantic. */
export function blueTheme(value) {
  const colors = {
    ff8500: '1d7fba', ff6b00: '0968ab', e67700: '0968ab', f27300: '0968ab', e07500: '0968ab',
    ff9a00: '1aa8d3', ff9500: '1aa8d3', ffa502: '1aa8d3', ff4d00: '0e3769',
    ffb366: '64c4d9', ff9a3c: '1aa8d3', ffb347: '64c4d9', ffa64d: '64c4d9',
    fffdf9: 'f7fbfe', fffaf5: 'f3f9fe', fff8ed: 'eef7fc', fff7ed: 'eef7fc',
    fafaf9: 'f7f9fc', f5f3f0: 'eef3f8', f6f6f5: 'f3f6fa',
  };
  return value.replace(/#([\da-f]{8}|[\da-f]{6})(?![\da-f])/gi, (match, hex) => {
    const replacement = colors[hex.slice(0, 6).toLowerCase()];
    return replacement ? `#${replacement}${hex.slice(6)}` : match;
  }).replace(/rgba?\(\s*(255|230|224|242)\s*,\s*(133|107|119|117|115|154|149|166|179)\s*,\s*(0|77|102)\s*(,\s*[^)]+)?\)/gi, (match, red, green, blue, alpha = '') => {
    const mapped = colors[[red, green, blue].map((n) => Number(n).toString(16).padStart(2, '0')).join('')];
    return mapped ? `${alpha ? 'rgba' : 'rgb'}(${parseInt(mapped.slice(0, 2), 16)},${parseInt(mapped.slice(2, 4), 16)},${parseInt(mapped.slice(4, 6), 16)}${alpha})` : match;
  });
}

function relevant(selector) {
  if (/^\s*(?:from|to|\d+(?:\.\d+)?%)(?:\s*,|$)/.test(selector)) return true;
  // A :is() or :where() list is a union: one captured branch is sufficient.
  // Requiring every class in the union would remove Font Awesome's shared
  // ::before renderer while leaving its per-icon glyph variable behind.
  let flattened = selector;
  for (let pass = 0; pass < 10; pass++) {
    const next = flattened.replace(/:(?:is|where)\(([^()]*)\)/g, (_match, branches) => postcss.list.comma(branches).some(relevant) ? '' : '.__opc_missing_union');
    if (next === flattened) break;
    flattened = next;
  }
  const names = [...flattened.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)].map((match) => match[1]);
  const identifiers = [...flattened.matchAll(/#([a-zA-Z_][\w-]*)/g)].map((match) => match[1]);
  return names.every((name) => classes.has(name)) && identifiers.every((name) => name === 'app' || ids.has(name));
}

function scoped(selector) {
  let result = selector.replace(/(^|[\s>+~])(?:html|body|:root|#app)(?=[:.#\[\s>+~]|$)/g, `$1${prefix}`);
  while (result.includes(`${prefix} ${prefix}`)) result = result.replaceAll(`${prefix} ${prefix}`, prefix);
  return result.startsWith(prefix) ? result : `${prefix} ${result}`;
}

const urls = new Set();
const restrictedImageUrls = new Set();
function assetUrl(raw, base = sourceCss) {
  try {
    const url = new URL(raw.replaceAll('&amp;', '&'), base);
    const streamedImage = url.hostname === 'mmbiz.qpic.cn' || url.hostname === 'hao-teacher.feishu.cn' && url.pathname.startsWith('/space/api/box/stream/download/');
    if (!['https:', 'http:'].includes(url.protocol) || !streamedImage && !/\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf)$/i.test(url.pathname)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}
export function assetPath(url) {
  const parsed = new URL(url);
  const format = parsed.searchParams.get('wx_fmt');
  const extension = path.extname(parsed.pathname).toLowerCase() || (format === 'png' ? '.png' : '.jpg');
  return `/opc/assets/${createHash('sha256').update(url).digest('hex').slice(0, 16)}${extension}`;
}
function scanStrings(value) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/https?:\/\/[^\s"'<>\\)]+/g)) {
      const normalized = assetUrl(match[0]);
      if (normalized) urls.add(normalized);
    }
  } else if (Array.isArray(value)) value.forEach(scanStrings);
  else if (value && typeof value === 'object') Object.values(value).forEach(scanStrings);
}
scanStrings(snapshots);
for (const name of ['public-content.json', 'public-directory.json']) scanStrings(JSON.parse(await fs.readFile(path.join(sourceRoot, name), 'utf8')));
try { scanStrings(JSON.parse(await fs.readFile(path.join(sourceRoot, 'unmapped-inline-images.json'), 'utf8'))); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const refs = JSON.parse(await fs.readFile(path.join(input, 'local-asset-refs.json'), 'utf8'));
for (const [name, values] of Object.entries(refs)) {
  if (name === 'index.css') continue;
  for (const raw of values) { const normalized = assetUrl(raw); if (normalized) urls.add(normalized); }
}

const sheets = ['index.css', ...(await fs.readFile(path.join(input, 'css-files.txt'), 'utf8')).trim().split(/\r?\n/)];
const combined = postcss.root();
for (const name of sheets) {
  const root = postcss.parse(await fs.readFile(path.join(input, name), 'utf8'), { from: name });
  root.walkComments((comment) => comment.remove());
  root.walkAtRules((rule) => {
    // Remote @imports are unnecessary. System Chinese fonts avoid a remote font dependency.
    if (rule.name === 'import' || rule.name === 'charset') rule.remove();
    if (/keyframes$/i.test(rule.name)) rule.params = `opc-${rule.params}`;
    if (rule.name === 'font-face' && !/Font Awesome/.test(rule.toString())) rule.remove();
  });
  root.walkRules((rule) => {
    if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
    const selectors = rule.selectors.filter((selector) => name !== 'index.css' && !name.startsWith('all-') || relevant(selector));
    if (!selectors.length) rule.remove();
    else rule.selectors = selectors.map(scoped);
  });
  root.walkDecls((decl) => {
    // The original app-wide admin reset is unrelated to these public pages.
    // It also defeats every keyboard focus ring, including our local controls.
    if (name === 'index.css' && decl.parent.type === 'rule' && decl.parent.selectors.every((selector) => selector === `${prefix} *`)) {
      if (decl.prop === 'font-family' || decl.prop === 'outline') { decl.remove(); return; }
    }
    decl.value = blueTheme(decl.value);
    if (/animation/.test(decl.prop)) {
      // Animation names are known from the source at-rules, and are unique after scoping.
      const keyframes = [...root.nodes].filter((node) => node.type === 'atrule' && /keyframes$/.test(node.name)).map((node) => node.params.slice(4));
      for (const keyframe of keyframes) decl.value = decl.value.replace(new RegExp(`(?<![\\w-])${keyframe}(?![\\w-])`, 'g'), `opc-${keyframe}`);
    }
    if (decl.prop === 'font-family' || decl.prop.startsWith('--fa-')) decl.value = decl.value.replace(/Font Awesome \d+ Brands/g, 'OPC Icons Brands').replace(/Font Awesome \d+ Free/g, 'OPC Icons Free');
    decl.value = decl.value.replace(/url\((['"]?)([^)'"\s]+)\1\)/g, (match, quote, raw) => {
      if (raw.startsWith('data:')) return match;
      const url = assetUrl(raw);
      if (!url) return 'none';
      urls.add(url);
      return `url("${assetPath(url)}")`;
    });
  });
  combined.append(root.nodes);
}
combined.walkAtRules((rule) => { if (!rule.nodes?.length && /^(media|supports|layer|container)$/.test(rule.name)) rule.remove(); });

// Scroll-reveal gates. The reference site relied on runtime JS to append `.revealed`
// as blocks entered the viewport; that script is deliberately not shipped, so every
// "base opacity:0 / transform offset, restored by `.revealed`" pair would keep whole
// card grids invisible (tool/course/opc/news/resource/rental/advantage/scenario/
// supply/demand/cta/event cards, sec-heads, stat items, process steps…).
// Collect the gated classes from the `.revealed` selectors, then neutralize the
// hidden base state in place — scope stays exact, and no unrelated rule moves.
const gatedClasses = new Set();
combined.walkRules((rule) => {
  if (!rule.selector.includes('.revealed')) return;
  for (const match of rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)) {
    if (match[1] !== 'revealed' && match[1] !== 'opc-replica') gatedClasses.add(match[1]);
  }
});
combined.walkRules((rule) => {
  if (rule.selector.includes('.revealed')) return;
  const own = [...rule.selector.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((match) => match[1]);
  if (!own.some((name) => gatedClasses.has(name))) return;
  rule.walkDecls((decl) => {
    if (decl.prop === 'opacity' && parseFloat(decl.value) === 0) decl.value = '1';
    if (decl.prop === 'transform' && /translate|scale|rotate/.test(decl.value)) decl.value = 'none';
  });
});

// Only Latin glyphs are used from the reference display fonts. Store two small
// variable-font files locally; Chinese text uses the operating-system font.
try {
  const fonts = postcss.parse(await fs.readFile(path.join(input, 'google-fonts.css'), 'utf8'));
  const seen = new Set();
  fonts.walkAtRules('font-face', (rule) => {
    if (!rule.toString().includes('U+0000-00FF')) return;
    const family = rule.nodes.find((node) => node.prop === 'font-family')?.value;
    if (seen.has(family)) return;
    seen.add(family);
    const face = rule.clone();
    face.walkDecls('font-weight', (decl) => { decl.value = family.includes('Sora') ? '600 800' : '400 700'; });
    face.walkDecls('src', (decl) => {
      decl.value = decl.value.replace(/url\(([^)]+)\)/g, (_match, raw) => {
        const url = assetUrl(raw.replace(/^['"]|['"]$/g, ''));
        if (!url) throw new Error('Unexpected font asset URL');
        urls.add(url);
        return `url("${assetPath(url)}")`;
      });
    });
    combined.append(face);
  });
} catch (error) { if (error.code !== 'ENOENT') throw error; }

const overrides = `
/* Local integration: document scrolling, keyboard focus and motion reduction. */
.opc-replica{font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:14px;line-height:1.65;color:#171717;background:#f7f9fc;min-height:100vh;height:auto!important;max-height:none!important;overflow:visible!important;isolation:isolate;--el-color-primary:#1d7fba;--el-color-primary-rgb:29,127,186;--el-color-primary-dark-2:#0968ab;--el-color-primary-light-9:#eef7fc;--el-color-primary-light-8:#d9edf8;--el-color-primary-light-7:#c1e1f2;--el-color-primary-light-5:#85bfdf;--el-color-primary-light-3:#50a1cf}
.opc-replica *,.opc-replica *::before,.opc-replica *::after{box-sizing:border-box}
.opc-replica .el-scrollbar,.opc-replica .scroll-wrap-product,.opc-replica .el-scrollbar__view{height:auto!important;max-height:none!important;overflow:visible!important}
.opc-replica .el-scrollbar__bar{display:none!important}
.opc-replica [class*="reveal-"],.opc-replica .reveal-on-scroll{opacity:1!important;visibility:visible!important;transform:none!important}
.opc-replica a:focus-visible,.opc-replica button:focus-visible,.opc-replica [tabindex]:focus-visible{outline:2px solid #1aa8d3;outline-offset:4px}
.opc-replica img{max-width:100%}
.opc-replica .opcheader{position:sticky;top:0;z-index:60}
.opc-replica .opcheader:has(nav.is-home){position:fixed;top:20px;width:100%;background:transparent}
.opc-replica .opcheader .nav-links{margin-block:1em;padding-inline-start:40px}
.opc-replica .nav-links a.active{color:#1aa8d3}
.opc-replica [hidden]{display:none!important}
.opc-replica .opc-local-status{padding:14px 18px;margin:16px 0;border:1px solid #c1e1f2;background:#eef7fc;color:#142f59;border-radius:8px;line-height:1.6}
@media(max-width:900px){.opc-replica .opcheader .nav-links{position:absolute;top:70px;left:0;right:0;display:none;flex-direction:column;gap:0;background:#fff;padding:12px 20px;box-shadow:0 8px 24px #142f591a;max-height:calc(100svh - 90px);overflow:auto}.opc-replica .opcheader.menu-open .nav-links{display:flex!important}.opc-replica .opcheader .nav-links li{width:100%}.opc-replica .opcheader .nav-links a{display:block;min-height:44px;padding:10px;color:#142f59}.opc-replica .opcheader .mobile-menu-btn{display:block!important}.opc-replica .container{max-width:100%;padding-left:20px;padding-right:20px}}
@media(prefers-reduced-motion:reduce){.opc-replica *,.opc-replica *::before,.opc-replica *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}
`;
await fs.writeFile(path.join(output, 'reference-blue.css'), `${combined.toString()}\n${overrides}`);
// An approval review rejected retrieval of these third-party streamed images.
// Keep all article text and use local placeholders; never request signed Feishu
// URLs or the additional external image hosts through this download pipeline.
for (const url of urls) {
  if (['mmbiz.qpic.cn', 'hao-teacher.feishu.cn'].includes(new URL(url).hostname)) restrictedImageUrls.add(url);
}
const requested = Object.fromEntries([...urls].sort().map((url) => [url, assetPath(url)]));
await fs.writeFile(path.join(manifests, 'asset-requests.json'), JSON.stringify(requested, null, 2));

function validAsset(buffer, extension) {
  if (!buffer.length) return false;
  if (extension === '.svg') return /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)?<svg\b/i.test(buffer.toString('utf8')) && !/<(?:script|foreignObject|iframe|object|embed)\b|\bon\w+\s*=|(?:javascript|data:text\/html)\s*:/i.test(buffer.toString('utf8'));
  if (/^\.woff2?$/.test(extension)) return ['wOFF', 'wOF2'].includes(buffer.subarray(0, 4).toString('ascii'));
  if (extension === '.ttf' || extension === '.otf') return ['OTTO', '\0\x01\0\0'].includes(buffer.subarray(0, 4).toString('ascii'));
  return buffer[0] === 0xff && buffer[1] === 0xd8 || buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || buffer.subarray(0, 3).toString() === 'GIF' || buffer.subarray(0, 4).toString() === 'RIFF' || buffer.subarray(0, 4).equals(Buffer.from([0,0,1,0])) || buffer.subarray(4, 8).toString() === 'ftyp';
}

function retrieve(url, destination) {
  return new Promise((resolve) => {
    const process = spawn('curl', ['--location', '--fail', '--silent', '--show-error', '--connect-timeout', '8', '--max-time', '35', '--max-filesize', '12582912', '--output', destination, url], { stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';
    process.stderr.on('data', (chunk) => { error += chunk; });
    process.once('error', (failure) => resolve(failure.message));
    process.once('exit', (code) => resolve(code === 0 ? null : error.trim().slice(0, 160)));
  });
}
const successful = {};
const failures = JSON.parse(await fs.readFile(path.join(manifests, 'asset-failures.json'), 'utf8').catch(() => '[]'));
let cursor = 0;
const jobs = Object.entries(requested);
await Promise.all(Array.from({ length: download ? 8 : 1 }, async () => {
  while (cursor < jobs.length) {
    const [url, publicPath] = jobs[cursor++];
    if (restrictedImageUrls.has(url)) {
      successful[url] = '/opc/assets/fallback-image.svg';
      failures.push({ url, error: 'Not downloaded: external streamed image retrieval rejected by automatic approval review' });
      continue;
    }
    const cachedPath = priorMap[url] || publicPath;
    const destination = path.join(project, 'public', cachedPath);
    let data = await fs.readFile(destination).catch(() => null);
    if (!data && download) {
      const failure = await retrieve(url, destination);
      if (failure) { failures.push({ url, error: failure }); await fs.rm(destination, { force: true }); continue; }
      data = await fs.readFile(destination).catch(() => null);
    }
    if (data && validAsset(data, path.extname(destination))) successful[url] = cachedPath;
    else if (download) { failures.push({ url, error: 'Unsupported or invalid image/font payload' }); await fs.rm(destination, { force: true }); }
    if (cursor % 100 === 0) console.log(`Assets processed: ${cursor}/${jobs.length}; available: ${Object.keys(successful).length}`);
  }
}));
// Next.js already ships sharp as its image optimizer. Reuse it without adding a
// runtime dependency, and keep the map authoritative when the extension changes.
let sharp;
try { sharp = createRequire(import.meta.resolve('next/package.json'))('sharp'); }
catch { /* A platform without the optional optimizer can use the valid originals. */ }
if (sharp) {
  let imageCursor = 0;
  const entries = Object.entries(successful);
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (imageCursor < entries.length) {
      const [url, publicPath] = entries[imageCursor++];
      if (!/\.(?:jpe?g|png|webp)$/i.test(publicPath)) continue;
      if (publicPath.endsWith('.webp') && priorMap[url] === publicPath) continue;
      const sourcePath = path.join(project, 'public', publicPath);
      const webpPath = publicPath.replace(/\.[^.]+$/, '.webp');
      const destination = path.join(project, 'public', webpPath);
      try {
        const image = sharp(sourcePath, { animated: false, limitInputPixels: 80_000_000 });
        const metadata = await image.metadata();
        const maximum = /\/nav\//.test(url) ? 256 : /home_[1-4]-/.test(url) ? 1920 : 1600;
        // SVG/fonts/GIF remain original; small logos with alpha remain crisp.
        const buffer = await image.rotate().resize({ width: maximum, height: maximum, fit: 'inside', withoutEnlargement: true }).webp({ quality: /home_[1-4]-/.test(url) ? 84 : 82, alphaQuality: 100, lossless: Boolean(metadata.hasAlpha && metadata.width <= 512 && metadata.height <= 512) }).toBuffer();
        const original = await fs.stat(sourcePath);
        if (buffer.length < original.size) {
          await fs.writeFile(destination, buffer);
          successful[url] = webpPath;
          if (destination !== sourcePath) await fs.rm(sourcePath);
        }
      } catch (error) { failures.push({ url, warning: `Optimization skipped: ${error.message.slice(0, 100)}` }); }
    }
  }));
}
let stylesheet = await fs.readFile(path.join(output, 'reference-blue.css'), 'utf8');
for (const [url, publicPath] of Object.entries(successful)) stylesheet = stylesheet.replaceAll(assetPath(url), publicPath);
await fs.writeFile(path.join(output, 'reference-blue.css'), stylesheet);
const isFallback = (value) => value?.includes('/fallback-');
const mirrored = Object.values(successful).filter((value) => !isFallback(value)).length;
const unresolved = [...new Map(failures.filter((failure) => !successful[failure.url] || isFallback(successful[failure.url]) || failure.warning).map((failure) => [failure.url, failure])).values()];
for (const failure of unresolved) {
  if (failure.error) successful[failure.url] = /raisound|favicon\.ico/.test(failure.url) ? '/opc/assets/fallback-tool.svg' : '/opc/assets/fallback-image.svg';
}
await fs.writeFile(path.join(manifests, 'asset-map.json'), JSON.stringify(successful, null, 2));
await fs.writeFile(path.join(manifests, 'asset-failures.json'), JSON.stringify(unresolved, null, 2));
console.log(JSON.stringify({ stylesheetBytes: (await fs.stat(path.join(output, 'reference-blue.css'))).size, requested: jobs.length, mirrored, fallback: Object.values(successful).filter(isFallback).length, failed: unresolved.length }));
