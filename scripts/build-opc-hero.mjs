#!/usr/bin/env node
/**
 * 生成 OPC 复刻站首页的科技蓝抽象主视觉。
 *
 * ## 为什么不用原来的大会合影
 *
 * 复刻态首页首屏是一张 2026 OPC 创新发展大会的合影，画面里的舞台背板写着
 * 原站运营方品牌「同橙OPC社区」的大字招牌。作为集智AI 站点的首屏，
 * 这是最显眼的一处品牌冲突，必须换掉。
 *
 * ## 为什么是 SVG 而不是位图
 *
 * - 主视觉是 1920×1080 的全屏背景，任何位图在这个尺寸下要么糊要么体积大；
 * - SVG 走渐变与几何线条，缩放无损，gzip 后只有几 KB；
 * - 与 `docs/06-视觉方案与3D动效规范.md` 的科技蓝体系统一，
 *   端点色全部取自 `logo.svg` 实测色板。
 *
 * 用法：node scripts/build-opc-hero.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(import.meta.dirname, '..', 'public/opc');
mkdirSync(OUT, { recursive: true });

/**
 * 四张主视觉，构成一套轮播。
 * 共同语言：深蓝底 + 科技网格 + 品牌色几何体 + 光晕。
 * 每张的构图重心不同，轮播时不会看得出重复。
 */
const scenes = [
  {
    id: 'grid',
    // 主网格：最通用的一张，做首帧
    body: `
    <defs>
      <linearGradient id="g-deep" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#0e3769"/>
        <stop offset="0.55" stop-color="#142f59"/>
        <stop offset="1" stop-color="#0a2a52"/>
      </linearGradient>
      <linearGradient id="g-fade" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="#0e3769" stop-opacity="0.95"/>
        <stop offset="0.6" stop-color="#0e3769" stop-opacity="0.35"/>
        <stop offset="1" stop-color="#0e3769" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="g-glow" cx="0.72" cy="0.28" r="0.55">
        <stop offset="0" stop-color="#1aa8d3" stop-opacity="0.42"/>
        <stop offset="0.5" stop-color="#0968ab" stop-opacity="0.16"/>
        <stop offset="1" stop-color="#0968ab" stop-opacity="0"/>
      </radialGradient>
      <pattern id="p-grid" width="64" height="64" patternUnits="userSpaceOnUse">
        <path d="M64 0H0V64" fill="none" stroke="#1aa8d3" stroke-opacity="0.13" stroke-width="1"/>
      </pattern>
      <pattern id="p-grid-fine" width="16" height="16" patternUnits="userSpaceOnUse">
        <path d="M16 0H0V16" fill="none" stroke="#64c4d9" stroke-opacity="0.06" stroke-width="0.6"/>
      </pattern>
    </defs>
    <rect width="1920" height="1080" fill="url(#g-deep)"/>
    <rect width="1920" height="1080" fill="url(#p-grid)"/>
    <rect width="1920" height="1080" fill="url(#p-grid-fine)"/>
    <rect width="1920" height="1080" fill="url(#g-glow)"/>

    <!-- 品牌几何：六边形箭形（呼应 logo.svg 的徽记轮廓） -->
    <g transform="translate(1380 540)" opacity="0.9">
      <path d="M0-260 L225-130 L225 130 L0 260 L-225 130 L-225-130 Z" fill="none" stroke="#1aa8d3" stroke-opacity="0.28" stroke-width="2"/>
      <path d="M0-170 L147-85 L147 85 L0 170 L-147 85 L-147-85 Z" fill="#0968ab" fill-opacity="0.14" stroke="#64c4d9" stroke-opacity="0.34" stroke-width="1.5"/>
      <path d="M0-84 L73-42 L73 42 L0 84 L-73 42 L-73-42 Z" fill="none" stroke="#1aa8d3" stroke-opacity="0.4" stroke-width="1.2"/>
      <circle cx="0" cy="0" r="26" fill="#1aa8d3" fill-opacity="0.5"/>
      <circle cx="0" cy="0" r="46" fill="none" stroke="#64c4d9" stroke-opacity="0.3" stroke-width="1"/>
    </g>

    <!-- 左下的弧形呼应 logo 的青绿弧 -->
    <g opacity="0.5">
      <path d="M120 1080 A 420 420 0 0 1 540 1080" fill="none" stroke="#57b6a5" stroke-opacity="0.3" stroke-width="2"/>
      <path d="M200 1080 A 340 340 0 0 1 540 1080" fill="none" stroke="#1fabbe" stroke-opacity="0.22" stroke-width="1.5"/>
    </g>

    <!-- 底部渐隐，保证白色标题可读 -->
    <rect y="480" width="1920" height="600" fill="url(#g-fade)"/>
    <g fill="#64c4d9" fill-opacity="0.5">
      <circle cx="150" cy="180" r="2.5"/><circle cx="420" cy="320" r="2"/>
      <circle cx="980" cy="150" r="2"/><circle cx="1700" cy="420" r="2.5"/>
      <circle cx="760" cy="880" r="2"/><circle cx="1560" cy="760" r="2"/>
    </g>`,
  },
  {
    id: 'flow',
    body: `
    <defs>
      <linearGradient id="f-deep" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#142f59"/><stop offset="1" stop-color="#0968ab"/>
      </linearGradient>
      <radialGradient id="f-glow" cx="0.28" cy="0.7" r="0.6">
        <stop offset="0" stop-color="#1fabbe" stop-opacity="0.38"/>
        <stop offset="1" stop-color="#1fabbe" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#f-deep)"/>
    <rect width="1920" height="1080" fill="url(#f-glow)"/>
    <!-- 流线：表达「链接 / 生态」 -->
    <g fill="none" stroke-linecap="round">
      <path d="M-100 760 C 400 620 620 900 1080 720 S 1700 520 2020 640" stroke="#64c4d9" stroke-opacity="0.34" stroke-width="2"/>
      <path d="M-100 840 C 420 700 640 980 1100 800 S 1720 600 2020 720" stroke="#1aa8d3" stroke-opacity="0.26" stroke-width="1.6"/>
      <path d="M-100 680 C 380 540 600 820 1060 640 S 1680 440 2020 560" stroke="#57b6a5" stroke-opacity="0.2" stroke-width="1.4"/>
      <path d="M-100 560 C 360 430 580 700 1040 520 S 1660 330 2020 450" stroke="#1aa8d3" stroke-opacity="0.14" stroke-width="1.2"/>
    </g>
    <!-- 节点 -->
    <g fill="#0e3769" stroke="#64c4d9" stroke-opacity="0.55" stroke-width="2">
      <circle cx="430" cy="726" r="13"/><circle cx="880" cy="812" r="10"/>
      <circle cx="1290" cy="672" r="14"/><circle cx="1660" cy="586" r="9"/>
    </g>
    <g fill="#1aa8d3" fill-opacity="0.75">
      <circle cx="430" cy="726" r="5"/><circle cx="1290" cy="672" r="5.5"/>
    </g>
    <g opacity="0.42">
      <path d="M1520 300 L1660 380 L1660 540 L1520 620 L1380 540 L1380 380 Z" fill="none" stroke="#1aa8d3" stroke-width="1.6"/>
      <path d="M1520 360 L1612 412 L1612 508 L1520 560 L1428 508 L1428 412 Z" fill="#0968ab" fill-opacity="0.2"/>
    </g>
    <rect y="520" width="1920" height="560" fill="#0e3769" fill-opacity="0.3"/>`,
  },
  {
    id: 'orbit',
    body: `
    <defs>
      <linearGradient id="o-deep" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stop-color="#0a2a52"/><stop offset="0.6" stop-color="#142f59"/><stop offset="1" stop-color="#0e3769"/>
      </linearGradient>
      <radialGradient id="o-core" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#64c4d9" stop-opacity="0.5"/>
        <stop offset="0.4" stop-color="#1aa8d3" stop-opacity="0.22"/>
        <stop offset="1" stop-color="#0968ab" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#o-deep)"/>
    <!-- 轨道系统 -->
    <g transform="translate(1400 520)" fill="none">
      <ellipse rx="430" ry="430" stroke="#1aa8d3" stroke-opacity="0.2" stroke-width="1.4"/>
      <ellipse rx="430" ry="168" stroke="#64c4d9" stroke-opacity="0.16" stroke-width="1.2"/>
      <ellipse rx="300" ry="300" stroke="#1aa8d3" stroke-opacity="0.14" stroke-width="1.2" transform="rotate(28)"/>
      <ellipse rx="300" ry="120" stroke="#57b6a5" stroke-opacity="0.14" stroke-width="1" transform="rotate(-18)"/>
      <circle r="120" fill="url(#o-core)"/>
      <circle r="52" fill="#0968ab" fill-opacity="0.5" stroke="#64c4d9" stroke-opacity="0.4"/>
      <circle r="26" fill="#1aa8d3" fill-opacity="0.6"/>
      <!-- 轨道上的粒子 -->
      <circle cx="430" cy="0" r="9" fill="#64c4d9" fill-opacity="0.8"/>
      <circle cx="-215" cy="84" r="7" fill="#1aa8d3" fill-opacity="0.7"/>
      <circle cx="240" cy="-180" r="6" fill="#57b6a5" fill-opacity="0.7"/>
      <circle cx="-120" cy="-270" r="8" fill="#64c4d9" fill-opacity="0.55"/>
    </g>
    <!-- 左侧的科技网格 -->
    <g opacity="0.5">
      <rect x="0" y="0" width="820" height="1080" fill="url(#p-grid-o)"/>
    </g>
    <defs>
      <pattern id="p-grid-o" width="56" height="56" patternUnits="userSpaceOnUse">
        <path d="M56 0H0V56" fill="none" stroke="#1aa8d3" stroke-opacity="0.1" stroke-width="1"/>
      </pattern>
    </defs>`,
  },
  {
    id: 'waves',
    body: `
    <defs>
      <linearGradient id="w-deep" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0968ab"/><stop offset="0.5" stop-color="#142f59"/><stop offset="1" stop-color="#0a2a52"/>
      </linearGradient>
      <linearGradient id="w-line" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#57b6a5" stop-opacity="0.05"/>
        <stop offset="0.5" stop-color="#64c4d9" stop-opacity="0.42"/>
        <stop offset="1" stop-color="#1aa8d3" stop-opacity="0.05"/>
      </linearGradient>
    </defs>
    <rect width="1920" height="1080" fill="url(#w-deep)"/>
    <!-- 波浪层：科技感的流动纹理 -->
    <g fill="none" stroke="url(#w-line)" stroke-width="1.6">
      <path d="M0 700 Q 240 620 480 690 T 960 700 T 1440 690 T 1920 700"/>
      <path d="M0 740 Q 240 660 480 730 T 960 740 T 1440 730 T 1920 740"/>
      <path d="M0 780 Q 240 700 480 770 T 960 780 T 1440 770 T 1920 780"/>
      <path d="M0 820 Q 240 740 480 810 T 960 820 T 1440 810 T 1920 820"/>
      <path d="M0 860 Q 240 780 480 850 T 960 860 T 1440 850 T 1920 860"/>
      <path d="M0 900 Q 240 820 480 890 T 960 900 T 1440 890 T 1920 900"/>
      <path d="M0 940 Q 240 860 480 930 T 960 940 T 1440 930 T 1920 940"/>
      <path d="M0 980 Q 240 900 480 970 T 960 980 T 1440 970 T 1920 980"/>
    </g>
    <!-- 顶部的方块矩阵 -->
    <g fill="#64c4d9">
      <rect x="1400" y="180" width="14" height="14" fill-opacity="0.4"/>
      <rect x="1440" y="180" width="14" height="14" fill-opacity="0.28"/>
      <rect x="1480" y="180" width="14" height="14" fill-opacity="0.16"/>
      <rect x="1400" y="220" width="14" height="14" fill-opacity="0.3"/>
      <rect x="1440" y="220" width="14" height="14" fill-opacity="0.18"/>
      <rect x="1480" y="220" width="14" height="14" fill-opacity="0.1"/>
    </g>
    <g fill="none" stroke="#1aa8d3" stroke-opacity="0.28" stroke-width="1.4">
      <path d="M1340 320 L1460 250 L1580 320 L1580 460 L1460 530 L1340 460 Z"/>
      <path d="M1390 350 L1460 310 L1530 350 L1530 430 L1460 470 L1390 430 Z" fill="#0968ab" fill-opacity="0.16"/>
    </g>
    <rect y="620" width="1920" height="460" fill="#0a2a52" fill-opacity="0.28"/>`,
  },
];

for (const scene of scenes) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080" preserveAspectRatio="xMidYMid slice" role="img" aria-label="集智AI OPC社区主视觉">${scene.body}</svg>`;
  writeFileSync(resolve(OUT, `hero-${scene.id}.svg`), svg);
  console.log(`✓ hero-${scene.id}.svg  ${(Buffer.byteLength(svg) / 1024).toFixed(1)}KB`);
}
console.log(`\n已生成 ${scenes.length} 张科技蓝主视觉 → public/opc/`);
