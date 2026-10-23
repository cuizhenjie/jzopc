/**
 * 独立 node 脚本的 .env 加载器。
 *
 * 为什么需要：Next.js（dev/build/start）会自动加载 .env / .env.local，
 * 但 `node scripts/xxx.mjs` 直跑时 process.env 里什么都没有——
 * admin:create / migrate-opc-news 因此误报「缺少数据库连接」。
 *
 * 语义（对齐 Next.js 的优先级，只低配不覆盖）：
 *   1. 先读 .env，再读 .env.local（后者覆盖前者）；
 *   2. 已存在于 process.env 的变量一律不动（shell 注入优先）；
 *   3. 文件不存在就跳过；解析只认 KEY=VALUE 行，忽略注释与空行，
 *      值两端的成对引号剥掉；不执行任何展开（$VAR 不替换）。
 */
import { existsSync, readFileSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
// scripts/lib/ → 项目根（跟随真实路径，软链仓库里也指对地方）
const root = await realpath(resolve(scriptDir, '..', '..'));

for (const name of ['.env', '.env.local']) {
  const path = resolve(root, name);
  if (!existsSync(path)) continue;
  for (const rawLine of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function dirname(path) {
  const i = path.lastIndexOf('/');
  return i < 0 ? '.' : path.slice(0, i);
}
