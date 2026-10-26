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
import { dirname, resolve as resolvePath, sep } from 'node:path';
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

/** parentURL 对应的文件是否位于 src/ 下（src 内部的相对导入才需要补后缀） */
function parentInsideSrc(parentURL) {
  if (!parentURL) return false;
  const parent = fileURLToPath(parentURL);
  return (
    parent.startsWith(srcDir + sep)
    || parent === srcDir
    // parentURL 可能带 ?query（如 json import attribute），比对前先剥掉
    || parent.split('?')[0].startsWith(srcDir + sep)
  );
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null;
    if (specifier.startsWith('@/')) {
      base = resolvePath(srcDir, specifier.slice(2));
    } else if (
      (specifier.startsWith('./') || specifier.startsWith('../'))
      && parentInsideSrc(context.parentURL)
    ) {
      // src 源码内部相对导入省略扩展名（如 lib/opc/llms.ts 的 './content'），
      // Node ESM 默认解析不认 —— 与 @/ 别名同一套后缀补全。
      // 命中文件才短路；json（带 with {type:'json'} 且显式扩展名）与
      // node: 内建走默认流程。
      base = resolvePath(dirname(fileURLToPath(context.parentURL.split('?')[0])), specifier);
    }
    if (base === null) return nextResolve(specifier, context);

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
