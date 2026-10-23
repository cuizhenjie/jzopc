/** Fetch local tool-card icons for the agent directory.

 * Source mechanism mirrors https://www.aidh.ai/ (per user request): that
 * directory renders every tool icon through Google's faviconV2 endpoint
 * (`t3.gstatic.cn/faviconV2?...&url={tool-url}`) — we reuse the same
 * mechanism at BUILD time and store files locally, so the site never calls
 * a third-party host at runtime.
 *
 * Usage: node scripts/fetch-tool-icons.mjs
 * Inputs : scripts/opc-source/public-directory.json (agents[].realUrl)
 * Output : public/opc/assets/tool-icons/{domain}.png
 *          scripts/opc-source/tool-icons.json  (domain → local path manifest)
 * Failures are recorded in the manifest as null and simply leave that tool
 * card without an icon — never blocks the content build.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = JSON.parse(await fs.readFile(path.join(project, 'scripts/opc-source/public-directory.json'), 'utf8'));
const outDir = path.join(project, 'public/opc/assets/tool-icons');
await fs.mkdir(outDir, { recursive: true });

// ── Host policy (Mimosa build-time constraint) ─────────────────────────────
// Only https; reject localhost/loopback/private/reserved literals. The local
// proxy's fake-ip DNS range (198.18.0.0/15) is allowed: the real destination
// is chosen by the proxy from the hostname, so public-ness is judged by name.
const FAVICON_HOST = 't3.gstatic.cn';
const allowedHost = (hostname) =>
  hostname === FAVICON_HOST
  && !['localhost', '127.0.0.1', '::1', '169.254.169.254'].includes(hostname);

const domains = new Set();
for (const tool of directory.agents ?? []) {
  let host;
  try { host = new URL(tool.realUrl).hostname.replace(/^www\./, ''); } catch { continue; }
  if (host) domains.add(host);
}
console.log(`工具域名 ${domains.size} 个（agents ${directory.agents.length} 条）`);

const manifest = JSON.parse(await fs.readFile(path.join(project, 'scripts/opc-source/tool-icons.json'), 'utf8').catch(() => '{}'));
let cursor = 0;
let ok = 0, miss = 0, skip = 0;
const CONCURRENCY = 6;

async function fetchIcon(host) {
  const target = `https://${FAVICON_HOST}/faviconV2?${new URLSearchParams({
    client: 'SOCIAL', type: 'FAVICON', fallback_opts: 'TYPE,SIZE,URL', size: '64', url: `https://${host}/`,
  })}`;
  const parsed = new URL(target);
  if (parsed.protocol !== 'https:' || !allowedHost(parsed.hostname)) throw new Error('host policy');
  const res = await fetch(target, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 64 || buffer.length > 262144) throw new Error(`size ${buffer.length}`);
  // Magic bytes: png / jpeg / gif / webp / ico / svg
  const head = buffer.subarray(0, 12);
  const valid = head[0] === 0x89 && head[1] === 0x50
    || head[0] === 0xff && head[1] === 0xd8
    || head.subarray(0, 3).toString('ascii') === 'GIF'
    || head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP'
    || head[0] === 0 && head[1] === 0 && (head[2] === 1 || head[2] === 2)
    || /^\s*(?:<\?xml|<svg)/i.test(buffer.toString('utf8', 0, 256));
  if (!valid) throw new Error('not an image');
  const extension = head[0] === 0xff && head[1] === 0xd8 ? 'jpg' : head[0] === 0x89 ? 'png' : head.subarray(0, 3).toString('ascii') === 'GIF' ? 'gif' : 'png';
  const name = `${host.replace(/[^a-z0-9.-]/gi, '_')}-${createHash('sha256').update(host).digest('hex').slice(0, 6)}.${extension}`;
  await fs.writeFile(path.join(outDir, name), buffer);
  return `/opc/assets/tool-icons/${name}`;
}

await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (cursor < [...domains].length) {
    const host = [...domains][cursor++];
    try {
      manifest[host] = await fetchIcon(host);
      ok++;
    } catch (error) {
      manifest[host] = null;
      miss++;
      console.warn(`✗ ${host}: ${error.message}`);
    }
  }
}));

// 已有文件但本次未重新下载的（manifest 里有旧路径且文件仍在）不计失败
for (const host of Object.keys(manifest)) {
  if (manifest[host]) skip++;
}
console.log(`完成：抓取成功 ${ok}，失败 ${miss}，清单共 ${skip} 条可用`);
await fs.writeFile(path.join(project, 'scripts/opc-source/tool-icons.json'), JSON.stringify(manifest, null, 2) + '\n');
