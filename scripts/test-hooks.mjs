/**
 * Node 内置测试运行器的模块解析补丁。
 *
 * 背景：项目在 `tsconfig.json` 里用 `paths: { "@/*": ["./src/*"] }` 定义别名，
 * Next.js 打包时会读 tsconfig，但 **Node 内置的类型剥离（type stripping）不读 tsconfig paths**，
 * 直接 `import ... from '@/lib/site/config'` 会报 ERR_MODULE_NOT_FOUND。
 *
 * 这里用 `module.registerHooks()`（Node ≥ 22.15 / 23.5，零依赖）在运行期把
 * `@/xxx` 映射回 `src/xxx`，让 `node --test` 能直接跑仓库里的 TypeScript 源码。
 *
 * 仅供 `pnpm test` 使用，不参与 Next.js 构建，也不被生产代码引用。
 */
import { registerHooks } from 'node:module';
import { statSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = resolvePath(repoRoot, 'src');

/** 依次尝试的后缀：原样 → .ts → .tsx → 目录 index */
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

/** 只接受普通文件，避免把目录当成模块（会抛 EISDIR） */
function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith('@/')) return nextResolve(specifier, context);

    const base = resolvePath(srcDir, specifier.slice(2));
    for (const suffix of CANDIDATE_SUFFIXES) {
      const candidate = base + suffix;
      if (isFile(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    // 找不到就交回默认解析流程，让报错信息保持原样（便于定位）
    return nextResolve(specifier, context);
  },
});
