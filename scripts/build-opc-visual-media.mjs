#!/usr/bin/env node
/** Offline, reproducible derivatives. Inputs remain intact; nothing is fetched. */
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lstat, mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', { paths: [dirname(require.resolve('next/package.json'))] }));
const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const manifestPath = resolve(root, 'scripts/opc-source/visual-media.json');
const outputRoot = resolve(root, 'public/opc/visual');
const checkOnly = process.argv.includes('--check');
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.assets)) throw new Error('Unsupported visual media manifest');
const ids = new Set();
const urls = new Set();

/** Never follow an output ancestor symlink, including while creating directories. */
async function verifyDirectory(directory, create = false) {
  const inside = relative(root, directory);
  if (inside === '..' || inside.startsWith(`..${sep}`)) throw new Error(`Output directory escapes repository: ${directory}`);
  let current = root;
  for (const part of inside.split(sep).filter(Boolean)) {
    const candidate = resolve(current, part);
    let info;
    try { info = await lstat(candidate); }
    catch (error) {
      if (error.code !== 'ENOENT' || !create) throw error;
      // Recheck the existing parent before mkdir; recursive mkdir could follow it.
      await verifyDirectory(current);
      try { await mkdir(candidate); }
      catch (creationError) { if (creationError.code !== 'EEXIST') throw creationError; }
      info = await lstat(candidate);
    }
    if (info.isSymbolicLink() || !info.isDirectory() || await realpath(candidate) !== candidate) {
      throw new Error(`Output directory must be a canonical repository directory: ${candidate}`);
    }
    current = candidate;
  }
}

async function localFile(source) {
  if (typeof source !== 'string' || source.startsWith('/') || source.split('/').includes('..') || /[\\\x00-\x1f]/.test(source)) throw new Error(`Invalid source: ${source}`);
  if (!['webimages/', 'scripts/opc-source/visual-originals/', 'public/opc/visual/'].some((prefix) => source.startsWith(prefix))) throw new Error(`Source outside media roots: ${source}`);
  const absolute = await realpath(resolve(root, source));
  if (relative(root, absolute).startsWith(`..${sep}`) || relative(root, absolute) === '..') throw new Error(`Source escapes repository: ${source}`);
  return absolute;
}

async function atomicWrite(path, value) {
  await verifyDirectory(dirname(path));
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, value, { flag: 'wx' });
  await verifyDirectory(dirname(path));
  await rename(temp, path);
}

await verifyDirectory(outputRoot, !checkOnly);
for (const asset of manifest.assets) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.id) || ids.has(asset.id)) throw new Error(`Invalid or duplicate asset id: ${asset.id}`);
  ids.add(asset.id);
  if (!['hero', 'photo', 'reference', 'logo', 'icon', 'mark'].includes(asset.kind)) throw new Error(`Invalid asset kind: ${asset.id}`);
  const bytes = await readFile(await localFile(asset.source));
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Undecodable image: ${asset.source}`);
  const sourceInfo = { sha256: sha256(bytes), width: metadata.width, height: metadata.height, bytes: bytes.length };
  if (checkOnly && JSON.stringify(asset.original) !== JSON.stringify(sourceInfo)) throw new Error(`Source changed: ${asset.source}; rebuild media`);
  const widths = asset.kind === 'hero' ? [960, 1920] : [null];
  const variants = [];
  for (const width of widths) {
    const filename = (asset.kind === 'icon' || asset.kind === 'mark') ? `${asset.id}.svg` : `${asset.id}${width ? `-${width}` : ''}.webp`;
    const url = `/opc/visual/${filename}`;
    if (urls.has(url)) throw new Error(`Duplicate output: ${url}`);
    urls.add(url);
    const outputPath = resolve(outputRoot, filename);
    let data;
    if (checkOnly) {
      const actual = await realpath(outputPath);
      if (dirname(actual) !== await realpath(outputRoot)) throw new Error(`Output escapes visual directory: ${url}`);
      data = await readFile(actual);
    } else if (asset.kind === 'icon') {
      // SVG icons are produced by their own audited generator. Keep their bytes.
      data = bytes;
    } else if (asset.kind === 'mark') {
      // Externally supplied brand SVGs (e.g. partner logos) land here verbatim:
      // vector bytes are copied as-is so scaling stays lossless at any size.
      data = bytes;
      await atomicWrite(outputPath, data);
    } else {
      let pipeline = sharp(bytes).rotate();
      if (asset.kind === 'hero') pipeline = pipeline.removeAlpha().resize({ width, withoutEnlargement: true });
      else if (asset.kind !== 'logo') pipeline = pipeline.resize({ width: 960, withoutEnlargement: true });
      data = await pipeline.webp(asset.kind === 'logo' ? { lossless: true, effort: 6 } : { quality: 80, effort: 5 }).toBuffer();
      await atomicWrite(outputPath, data);
    }
    const result = await sharp(data).metadata();
    const variant = { url, width: result.width, height: result.height, bytes: data.length, sha256: sha256(data) };
    if (result.width > metadata.width || result.height > metadata.height) throw new Error(`Unexpected upscaling: ${url}`);
    if (checkOnly && JSON.stringify(asset.variants?.find((v) => v.url === url)) !== JSON.stringify(variant)) throw new Error(`Derivative changed: ${url}; rebuild media`);
    variants.push(variant);
  }
  asset.original = sourceInfo;
  asset.variants = variants;
}
if (!checkOnly) {
  manifest.pipeline = { version: 1, sharp: sharp.versions.sharp, vips: sharp.versions.vips, webp: sharp.versions.webp, photographicQuality: 80, maxPhotoWidth: 960, heroWidths: [960, 1920], logoEncoding: 'lossless; original dimensions' };
  await atomicWrite(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}
console.log(`${checkOnly ? 'Verified' : 'Built'} ${manifest.assets.length} visual sources / ${urls.size} local variants; originals preserved.`);
