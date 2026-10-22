/** Brand-native service marks. Run again to reproduce the complete SVG set. */
import { lstat, mkdir, realpath, rename, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const output = resolve(root, 'public/opc/visual');

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
const marks = {
  agent: '<path d="m32 9 20 11v24L32 55 12 44V20Z"/><path d="m12 20 20 12 20-12M32 32v23"/><path d="M23 24v-8m18 8v-8M25 41h14"/>',
  market: '<path d="M11 22h40l-6-10H17Z"/><path d="M15 22v29h34V22M24 51V36h16v15"/><path d="M11 22v5a5 5 0 0 0 10 0 5 5 0 0 0 11 0 5 5 0 0 0 11 0 5 5 0 0 0 10 0v-5"/>',
  academy: '<path d="m7 25 25-13 25 13-25 13Z"/><path d="M17 31v14c8 8 22 8 30 0V31M56 26v19"/><circle cx="56" cy="48" r="3"/>',
  star: '<path d="m32 9 7 14 16 3-11 12 2 16-14-7-14 7 2-16L9 26l16-3Z"/><path d="m22 33 7 7 14-15"/>',
  community: '<circle cx="32" cy="22" r="9"/><path d="M17 52v-7a15 15 0 0 1 30 0v7"/><path d="M15 16a7 7 0 1 0 0 14M49 16a7 7 0 1 1 0 14M8 49v-9a9 9 0 0 1 9-9m39 18v-9a9 9 0 0 0-9-9"/>',
  work: '<rect x="10" y="12" width="44" height="38" rx="5"/><path d="M10 23h44M26 23v27M23 57h18M32 50v7"/><path d="m35 32 5 5 8-9"/>',
  computing: '<path d="M16 43a12 12 0 0 1-1-24 17 17 0 0 1 32-1 13 13 0 0 1 1 25"/><rect x="23" y="31" width="18" height="20" rx="3"/><path d="M29 27v4m6-4v4M29 51v5m6-5v5M19 37h4m-4 8h4m18-8h4m-4 8h4M29 38h6v6h-6Z"/>',
  gpu: '<rect x="17" y="17" width="30" height="30" rx="4"/><rect x="24" y="24" width="16" height="16" rx="2"/><path d="M24 9v8m8-8v8m8-8v8M24 47v8m8-8v8m8-8v8M9 24h8m-8 8h8m-8 8h8m30-16h8m-8 8h8m-8 8h8"/>',
};

await verifyDirectory(output, true);
for (const [name, paths] of Object.entries(marks)) {
  // No external font, filter or raster dependency; the host provides the label.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect x="3" y="3" width="58" height="58" rx="14" fill="#eef4fa"/><g stroke="#0968ab" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g></svg>\n`;
  const target = resolve(output, `icon-${name}.svg`);
  const temporary = `${target}.${process.pid}.tmp`;
  await verifyDirectory(output);
  await writeFile(temporary, svg, { flag: 'wx' });
  await verifyDirectory(output);
  await rename(temporary, target);
}
console.log(`Generated ${Object.keys(marks).length} service icons.`);
