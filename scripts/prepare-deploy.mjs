#!/usr/bin/env node
/**
 * 裸机部署产物组装。
 *
 * 把 standalone 构建产物拼成**一个自包含的目录**，服务器上只需要
 * node ≥20，不需要 pnpm、不需要源码、不需要项目 node_modules：
 *
 *   deploy/
 *   ├── server.js          ← 启动入口
 *   ├── node_modules/      ← standalone 自带的最小依赖
 *   ├── src/               ← 运行时读取的字体（OG 图中文渲染必需）
 *   ├── .next/             ← server + static
 *   ├── public/            ← 静态资源
 *   └── pm2.config.cjs     ← 进程守护配置
 *
 * ## 用法
 *
 *   NEXT_OUTPUT_STANDALONE=1 pnpm build   # 必须先构建
 *   pnpm prepare:deploy                    # 再组装
 *
 * ## 为什么要有这个脚本
 *
 * standalone 的产物分三处，缺一不可：
 *   - `.next/standalone/` —— server 与最小 node_modules
 *   - `.next/static/`     —— 客户端 JS/CSS，**不在** standalone 目录里，漏了整站白屏
 *   - `public/`           —— favicon 等静态文件
 *
 * 少拷任何一样都不会报错，只会在线上表现成「样式丢了」「图标 404」。
 * 所以这个脚本**不只做拷贝，还做校验**，缺件直接退出非零。
 */
import { cpSync, existsSync, rmSync, statSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const nextDir = join(root, '.next');
const standalone = join(nextDir, 'standalone');
const deployDir = join(root, 'deploy');

/** 运行时必须存在的文件（缺了会「静默降级」而不是报错） */
const REQUIRED = [
  { path: join(standalone, 'server.js'), hint: '请用 NEXT_OUTPUT_STANDALONE=1 pnpm build 构建' },
  { path: join(standalone, 'src/app/api/og/fonts/NotoSansSC-Regular.otf'), hint: 'OG 图中文字体缺失：分享图会变成豆腐块（HTTP 仍 200，极难发现）' },
  { path: join(nextDir, 'static'), hint: '客户端 JS/CSS 缺失：整站会白屏' },
  { path: join(root, 'public'), hint: 'public 目录缺失' },
];

function fail(msg) {
  console.error(`\n✖ 部署产物不完整：${msg}\n`);
  process.exit(1);
}

// 1) 校验
for (const { path, hint } of REQUIRED) {
  if (!existsSync(path)) fail(`${path.replace(root + '/', '')} 不存在 —— ${hint}`);
}

// 2) 组装（先清空，避免上一版残留）
rmSync(deployDir, { recursive: true, force: true });
cpSync(standalone, deployDir, { recursive: true });
cpSync(join(nextDir, 'static'), join(deployDir, '.next/static'), { recursive: true });
cpSync(join(root, 'public'), join(deployDir, 'public'), { recursive: true });

// 3) 把进程守护配置一并带进部署目录（服务器只需这一个目录）
const pm2Config = join(root, 'pm2.config.cjs');
if (existsSync(pm2Config)) cpSync(pm2Config, join(deployDir, 'pm2.config.cjs'));

// 4) 自检：static 目录不能是空的（空目录说明构建没产出客户端资源）
const staticEntries = readdirSync(join(deployDir, '.next/static'));
if (staticEntries.length === 0) fail('deploy/.next/static 是空的 —— 客户端资源没打出来');

function dirSize(dir) {
  let total = 0;
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  walk(dir);
  return (total / 1024 / 1024).toFixed(1);
}

console.log('\n✅ 部署产物已组装');
console.log(`   目录：deploy/`);
console.log(`   体积：${dirSize(deployDir)} MB（含 standalone 最小 node_modules）`);
console.log('');
console.log('   服务器上启动：');
console.log('     cd deploy && PORT=3000 HOSTNAME=127.0.0.1 NODE_ENV=production node server.js');
console.log('');
console.log('   用 pm2 守护（可选）：');
console.log('     cd deploy && pm2 start pm2.config.cjs && pm2 save');
console.log('');
console.log('   ⚠️ NEXT_PUBLIC_* 是**构建期**内联的，改域名要重新构建，不能只改运行时环境变量。');
console.log('');
