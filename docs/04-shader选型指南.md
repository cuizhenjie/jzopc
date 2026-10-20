# 集智 AI OPC 社区 · Shader 组件选型指南

| 项 | 内容 |
|---|---|
| 文档版本 | v1.0（**数字已由 lead 独立复测修正**，见 §0.1） |
| 日期 | 2026-10-20 |
| 关联文档 | `docs/01-需求文档.md` §7.3（D-01～D-04）、`docs/02-技术方案.md` §7（3D / Shaders 动效方案） |
| 结论性质 | **选型决策 + 实测数据**，可直接替换技术方案 §7 的实现路线 |
| 测量环境 | macOS arm64 / Node 24.13.0 / esbuild 0.25 `--bundle --format=esm --minify` + `gzip -9` |

---

## 0. 结论速览

> **一句话：Hero「众智星云」的粒子层保留 Three.js + R3F 自写 GLSL（唯一不可替代的部分）；背景层与八大赋能能量环改用 `@paper-design/shaders-react`（WebGL，零运行时依赖，全库 gzip 仅 11.6KB）；`shaders`（shaders.com，WebGPU）本期不用。**

| 场景 | 选定方案 | 体积增量（实测 gzip） | 理由 |
|---|---|---|---|
| D-01 Hero「众智星云」粒子层 | **Three.js + R3F 自写 GLSL**（保留技术方案 §7.3） | ~252KB gzip | 真 3D 粒子向心汇聚，两个现成库都做不了 |
| D-01 Hero 背景层（极光/星云底） | **`@paper-design/shaders-react` → `MeshGradient`** | ~11.6KB gzip（全库） | 替代手写 FBM 背景层，省一个 GLSL 文件且性能更好 |
| D-02 八大赋能能量环 | **`@paper-design/shaders-react` → `PulsingBorder` / `DotOrbit`** | 含在上项内 | 2D 光环用 3D Torus 是浪费；props 可直接绑 React state 做 hover 高亮 |
| D-03 智能体卡片微动效 | CSS（技术方案 §7.5 已定，不动） | 0 | — |
| D-04 数字指标滚动 | Framer Motion（不动） | 0 | — |
| **全站背景底纹（新增可选）** | `Paper` → `Dithering` / `GrainGradient` | 含在上项内 | 浅底区块的科技感底纹 |

**总预算影响**：252KB（three+r3f）+ 11.6KB（paper 全库）≈ **264KB gzip**，较原技术方案 180KB 预算上调 **+47%**——但 3D 只在首页 Hero 异步挂载，移动端走降级后实际首屏增量 ≈ 0。

### 0.1 本文档数字的复核记录

> 本文档初稿由子代理产出，**lead 已用同一套 esbuild + gzip 流程独立复测全部关键数字**，结果如下。
> 复测环境：`/tmp/jz_shader_bench`，依赖 `shaders@4.0.4`、`@paper-design/shaders-react@0.0.81`、`@paper-design/shaders@0.0.81`、`three@0.186.1`、`@react-three/fiber@9.8.2`、`esbuild@0.25.0`。

| 方案 | 初稿声称 gzip | **lead 实测 gzip** | 判定 |
|---|---|---|---|
| `shaders/react`（Shader + Aurora） | 717.6 KB | **727.5 KB**（raw 2,608,873） | ✅ 确认，差 1.4% |
| `@paper-design/shaders-react`（全库） | 39.5 KB | **11.6 KB**（raw 35,227） | ⚠️ 初稿偏高 3.4 倍，**不影响结论**（实际更小） |
| `three` + `@react-three/fiber`（具名导入） | 247.9 KB | **251.6 KB**（raw 940,233） | ✅ 确认，差 1.5% |
| Paper React 组件数 | 37 | **31 个 React 组件**（`ColorPanels`…`Waves`） | ⚠️ 已修正 |
| `shaders` 为 WebGPU-only | 是 | ✅ 确认：dist 内 6 个文件引用 `navigator.gpu`，**0 个引用 WebGL** | ✅ |
| Paper 为 WebGL/GLSL | 是 | ✅ 确认：`@paper-design/shaders` core 内 4 个文件引用 `getContext`、0 个引用 `navigator.gpu`，存在 `shaderSource`/`varying` 痕迹；**零运行时依赖** | ✅ |
| 体积对比结论（shaders 比 three+r3f 贵约 2.9 倍） | — | ✅ 727.5 / 251.6 = **2.89 倍**，确认 | ✅ |

> 初稿的 `R6「docs/03-开发计划.md 缺失」`为**误判**（当时读到的目录快照不完整），该文件实际存在且完整，已删除该条。
> 另：初稿 §1.1 提到的「207 个 core chunk、203 个 import std-*.js、std 589KB」在 `shaders@4.0.4` 包内复核一致（207 chunk / 203 个引用 std），但**端到端打包实测（727.5KB）已直接证明 tree-shaking 收益极低**，无需再依赖包结构推断。

---

## 1. 三个候选库的实测对比

### 1.1 体积实测（这是本次选型的决定性因素）

用 esbuild 真实打包 + `gzip -9`（**lead 复测值，测量目录 `/tmp/jz_shader_bench`**）：

| 方案 | 打包内容 | raw | gzip |
|---|---|---|---|
| `shaders/react`（shaders.com，WebGPU） | `Shader` + `Aurora` **仅 2 个** | 2,608,873 | **727.5 KB** |
| `shaders/react` | `Shader` + `Aurora` + `Nebula` + `Ring` + `Ripples` + `ParticleField`（6 个） | — | 718.8 KB（初稿值，未单独复测） |
| `three` + `@react-three/fiber` | `BufferGeometry` / `ShaderMaterial` / `Points` / `AdditiveBlending` / `Vector3` + `Canvas` / `useFrame` | 940,233 | **251.6 KB** |
| `@paper-design/shaders-react` | **全库 31 个 React 组件** | 35,227 | **11.6 KB** |
| `@paper-design/shaders-react` | 单个组件 `MeshGradient` | 35,237 | **11.6 KB**（与全库同量级，tree-shaking 收益有限） |

**关键发现（`shaders` 为什么 tree-shake 不掉）**：

```
shaders@4.0.4 包结构
├─ dist/core/            207 个 chunk
│   ├─ std-*.js          589 KB gzip  ← 全局 std 原语（fields/palettes/light/noise/shapes/warps/filters）
│   └─ <Component>.js    每个组件一个 chunk
├─ dist/react/index.js   3.2 KB gzip   ← 入口只做 re-export，看起来很轻
└─ typegpu@0.12.3        204 KB gzip   ← WebGPU 抽象层，运行时依赖

实测：207 个 core chunk 中有 203 个 import 了 std-*.js
```

→ 只要用任意一个组件，就会拉进 **589KB std + 204KB typegpu ≈ 793KB**，加自身约 718KB gzip。
→ **端到端实测 727.5 KB，比整个 three + r3f（251.6 KB）还贵 2.89 倍，比本项目原 180KB 预算贵 4 倍。**

> 另：`shaders@4.0.4` 的 `dist` 内**只有 WebGPU 引用（6 个文件）、零 WebGL 引用**，且依赖 `typegpu`（WebGPU 抽象层）→ **没有 WebGL 降级路径**。

### 1.2 完整能力对比

| 维度 | `shaders`（shaders.com） | `@paper-design/shaders-react` | `three` + R3F |
|---|---|---|---|
| npm 版本 | 4.0.4 | 0.0.81 | three 0.186.1 / r3f 9.8.2 |
| 渲染 API | **WebGPU**（WGSL） | **WebGL**（GLSL） | WebGL / WebGPU |
| 组件数 | 200（分 10 类，core 207 chunk） | **31 个 React 组件**（实测导出） | 无限（自写） |
| 3D 能力 | ❌ 无场景/相机/网格，纯 2D 表面效果 | ❌ 同左 | ✅ 完整 3D |
| 运行时依赖 | `typegpu` 0.12.3 | **零依赖** | 无 |
| 许可 | MIT（引擎与组件） | Apache-2.0 | MIT |
| 无 WebGPU 时 | **canvas 保持透明**，无 WebGL 回退，无 CSS 回退 | 正常 | 有 WebGL2 → WebGL1 降级链 |
| 交互 props 驱动 | ✅ 绑 state 不重编译 | ✅ 同左 | 需手写 uniform |
| 自定义 shader | `defineShader` + `wgsl`（**官方标注 experimental，minor 版本可能破坏**） | 纯 GLSL，需自写 | ✅ 完全自由 |
| 付费部分 | Pro：1000+ preset、55+ website section、CLI、MCP、Framer 插件 | 全免费 | 全免费 |
| React / Next.js | React 18/19，App Router 用 `'use client'` | React 18/19 | React 18/19 |

### 1.3 浏览器覆盖率 —— WebGPU 是本项目的硬伤

**WebGPU 全球覆盖率（2026 年中，caniuse 聚合）**：82.17% 完全支持 + 1.46% 部分支持 ≈ **84%**

| 环境 | WebGPU 状态 |
|---|---|
| Chrome / Edge 桌面 | ✅ 稳定版（2023-04 起） |
| Safari 26 / iOS 26 / iPadOS / macOS | ✅ 默认开启 |
| Chrome Android 12+（ARM / Qualcomm / Intel GPU） | ✅ Chrome 121 起 |
| **Samsung Xclipse GPU** | ⏳ 官方状态页仍列「进行中」→ **有相当比例安卓机不支持** |
| **Firefox Android** | ❌ 默认关闭（Mozilla 预计 2026 年内推进） |
| 移动端整体 | **~70–80%** |

**微信内置浏览器（本项目主要传播渠道，FR-SITE-04 明确要求微信分享有图有标题）**：

| 端 | 内核 | WebGPU 风险 |
|---|---|---|
| iOS 微信 | WKWebView（随 iOS 版本） | 需 iOS 26 才支持；旧 iOS 无 |
| Android 微信 | 腾讯自研 **XWEB** 内核（2020 后）/ 旧版 X5·TBS Blink | ⚠️ 公开 UA 样本显示 XWEB 报 `Chrome/111.0.5563.116`（2023-10 上报数据），**低于 WebGPU 门槛 Chrome 113** |
| 动态性 | 用户可在微信 TBS 调试页禁用 X5 切回系统 WebView | 内核版本会变，**不能假设** |

> **结论**：`shaders`（WebGPU）在微信内置浏览器里大概率只显示一片透明。
> 而 FR-SITE-04 要求微信/微博/飞书分享体验正常 —— 这些渠道的流量恰恰是最需要视觉说服力的。
> **本项目不用 WebGPU。**

---

## 2. 逐场景选型落地

### D-01 Hero「众智星云」（P0）—— 唯一必须用 3D 的地方

PRD 要求：「深藏蓝夜空 + 中心星云 + 大量微粒向心汇聚」，表达「集众智之力」。

**能力匹配分析**：

| 要点 | `shaders` (WebGPU) | Paper Shaders (WebGL) | Three.js + R3F |
|---|---|---|---|
| 3D 粒子向心汇聚 | ❌ 无 3D 场景 | ❌ 无 3D 场景 | ✅ `THREE.Points` + 顶点着色器 |
| CPU 每帧回传位置 | — | — | ❌ 必须避免（用顶点着色器算） |
| 32000 粒子 | 2D 画布扛不住 | 2D 画布扛不住 | ✅ 分级 32000/12000/4000/0 |
| 鼠标引力 `uPointer` | ✅ | 部分支持 | ✅ |

→ **粒子层只能用 Three.js + R3F**（技术方案 §7.3 的实现思路是对的，保留）。
→ 但**背景层可以外包**：技术方案 §7.3 的「背景层 = FBM 四阶噪声生成流动极光带」用 `MeshGradient` 替代即可，省一个 GLSL 文件。

**推荐组合**：

```
Hero
├── [Paper] MeshGradient   ← 背景层：流动色带（替代手写 FBM）
│     colors={['#142F59', '#1D7FBA', '#57B6A5', '#1AA8D3']}
│     distortion={0.8} swirl={0.15} speed={0.25}
├── [R3F]  <NebulaParticles/> ← 粒子层：32000 点向心汇聚 + curl noise + uPointer
└── HTML    Logo + 主标 + 副标 + CTA（永远在 canvas 之上，先渲染）
```

**性能护栏**：
- Paper 层：`minPixelRatio={1}`（默认是 2，移动端直接翻倍填充率）、`maxPixelCount={2_000_000}`
- R3F 层：DPR ≤1.5（移动 ≤1.25）、不可见时 `frameloop='never'`、粒子数分级
- 两者都 `next/dynamic` + `ssr:false`，且在 `requestIdleCallback` / LCP 之后挂载

### D-02 八大赋能能量环（P1）—— 降级为 2D

技术方案原写「`TorusGeometry` + `ShaderMaterial` 菲涅尔边缘光 + 8 个 `InstancedMesh` 节点」。

**评估**：这需要再叠一层 three（已在预算内，但成本高）+ 手写边缘光 shader + 8 节点 hover 状态同步。
**替代**：一个 Paper canvas + `PulsingBorder`（呼吸边框）或 `DotOrbit`（轨道点阵），8 个节点的亮度直接绑 React state 的 props。

**收益**：hover 高亮从「每帧改 uniform + 插值」变成「改一个 prop」，代码量降一个量级，且不与 Hero 的 three 实例抢 GPU 上下文。

> 移动端继续按技术方案 §7.4 降级为 CSS `conic-gradient` 光环（成本近零）。

### D-03 智能体卡片微动效（P1）

技术方案 §7.5 已定：CSS `perspective()` + 径向渐变扫光，零 WebGL 开销。**保持不变**。

### D-04 数字指标滚动（P1）

Framer Motion。**保持不变**。

### 新增建议：子页 Banner 底纹（P2）

八大赋能子页统一用「banner + 模块内容」模板（PRD §5.3）。建议每个 Banner 背景加一层 `Dithering` 或 `GrainGradient` 低强度底纹（`opacity` 0.1–0.2），用 `StaticMeshGradient` 更稳。

---

## 3. 推荐组件清单与品牌色映射

> Paper Shaders 全量目录（**实测 31 个 React 组件**，来源 `shaders.paper.design` 官方首页 + 实测导出核对）：
> **Image Filters(8)** paper texture / fluted glass / water / image dithering / halftone dots / halftone cmyk / lens distortion
> **Logo Animations(3)** heatmap / liquid metal / gem smoke
> **Effects(26)** mesh gradient / static mesh gradient / static radial gradient / dithering / grain gradient / dot orbit / dot grid / warp / spiral / swirl / waves / neuro noise / perlin noise / simplex noise / voronoi / pulsing border / metaballs / color panels / smoke ring / god rays

### 3.1 品牌色板（来自 `logo.svg` 实测，不得臆造）

| 用途 | 色值 |
|---|---|
| 深藏蓝（Hero 底色） | `#142F59` |
| 主蓝 | `#1D7FBA` |
| 青绿（点缀 / 数字强调） | `#57B6A5` |
| 亮青（渐变端 / 高亮） | `#1AA8D3` |
| 品牌渐变 | `#0968AB` → `#64C4D9` |
| 中性文字灰 | `#4D5153` |

### 3.2 选型映射表

| 组件 | 用于 | 关键 props（含建议值） | 风格定位 |
|---|---|---|---|
| `MeshGradient` | **D-01 Hero 背景层** | `colors={['#142F59','#1D7FBA','#57B6A5','#1AA8D3']}` `distortion={0.8}` `swirl={0.15}` `speed={0.25}` `minPixelRatio={1}` | 流动色带 · 极光感 · 品牌主视觉 |
| `StaticMeshGradient` | Hero 降级底 / `prefers-reduced-motion` | 同上 + `speed={0}` | 静态版，零动画开销 |
| `GodRays` | Hero 顶部聚光（可选） | `colors={['#1AA8D3','#57B6A5']}` `intensity={0.35}` | 「集众智之力」的向心光束 |
| `Metaballs` | 「众智汇聚」概念（可选） | `color1="#1D7FBA"` `color2="#57B6A5"` `speed={0.2}` | 智能体融合 |
| `Spiral` | 向心汇聚（可选，比 Metaballs 更克制） | `color1="#1AA8D3"` `color2="#142F59"` `speed={0.15}` | 螺旋汇聚 |
| `PulsingBorder` | **D-02 八大赋能能量环** | `color1="#1AA8D3"` `color2="#57B6A5"` `speed={0.4}` | 呼吸节点 |
| `DotOrbit` | D-02 备选（轨道感更强） | `color="#1D7FBA"` `size={1}` `speed={0.3}` | 轨道点阵 |
| `DotGrid` | 智能体列表 / 算力超市底纹 | `color="#1D7FBA"` `gap={28}` `speed={0.1}` | 网格 · 算力感 |
| `Waves` | 子页 Banner 流动感 | `color1="#0968AB"` `color2="#64C4D9"` `speed={0.2}` | 平缓波纹 |
| `Swirl` | 智能体详情页局部装饰 | `color1="#1D7FBA"` `color2="#57B6A5"` `speed={0.3}` | 流体 · 个性化 |
| `Dithering` | 浅底区块科技底纹 | `color="#1D7FBA"` `opacity={0.12}` | 像素抖动 · 工业感 |
| `GrainGradient` | 深色区块颗粒质感 | `colors={['#142F59','#1D7FBA']}` `grainOverlay={0.15}` | 胶片颗粒 |
| `SimplexNoise` / `PerlinNoise` | 纹理底（慎用，纯装饰易噪） | `colors={['#142F59','#1AA8D3']}` `speed={0.1}` | 有机噪声 |
| `Voronoi` | 生态伙伴 / 分布感（可选） | `color1="#1D7FBA"` `color2="#57B6A5"` `speed={0.2}` | 细胞分布 |
| `ColorPanels` | 需强视觉冲击时才用 | `colors={['#142F59','#1D7FBA','#57B6A5']}` | 旋转面板 · 偏炫 |
| `FlutedGlass` / `Glass` 系 | 卡片玻璃质感（CSS 即可，不必用 shader） | — | 建议用 CSS `backdrop-filter` 替代 |

> **禁用清单**：`LiquidMetal` / `GemSmoke` / `Glowsticks` / `NeonSwarm` / `Hologram` 系 —— 与「冷静、有层次，不炫技」（PRD D-01 产品要求）冲突，且容易喧宾夺主。
> **彩虹色禁令**：PRD §7.3 明确「禁止彩虹色」，所有 `colors` 数组必须取自上表品牌色板。

---

## 4. 设计风格参考

### 4.1 Paper Shaders 的三条风格主线

| 风格线 | 组件 | 气质 | 集智适用度 |
|---|---|---|---|
| **流体有机** | mesh gradient / swirl / waves / warp / spiral | 柔和、流动、有生命感 | ★★★★★ Hero 与赋能区首选 |
| **科技颗粒** | dithering / grain gradient / simplex noise / perlin noise / voronoi / dot grid | 精密、工业、数据感 | ★★★★☆ 算力超市 / 学院 / 供给区 |
| **质感拟物** | liquid metal / gem smoke / fluted glass / heatmap / color panels | 高端、贵重、强视觉 | ★★☆☆☆ 慎用，破坏「克制」基调 |

### 4.2 `shaders` Pro 集合（可作风格 moodboard，不必引入库）

即使不用这个库，Pro 集合的命名体系也是很好的风格参考库。与集智契合的：

| 集合名 | 中文气质 | 对应场景 |
|---|---|---|
| **Dense Nebula** | 稠密星云 | D-01 Hero「众智星云」 |
| **Point Waves** | 点状波纹 | 粒子向心扩散 |
| **Cold Current** | 冷色流 | 深藏蓝科技基调 |
| **Horizon Drift** | 地平线漂移 | Hero 远景层 |
| **Mesh Flow** | 网格流 | 算力超市 |
| **Network Lights** | 网络灯阵 | 智能体 / 生态伙伴 |
| **Data Cube** | 数据立方 | 算力 / 指标条 |
| **Chrome Rings** | 铬环 | D-02 能量环 |
| **Traced Paths / Traced Lines** | 描边线路 | 网络拓扑 |
| **Glass Facets / Glass Ribbon / Pop Glass** | 玻璃切面 | 卡片拟态（CSS 化） |
| **Isotopes** | 同位素 | 粒子感 |
| **Scanning / Static Noise / Scanner Noise** | 扫描噪点 | 科技底纹 |
| **Color Eclipse** | 色彩食 | 品牌渐变 |
| **Radiance** | 辉光 | 光晕 |
| **Minted / Suspended Frost** | 冷调高级感 | 学院 / 资本政策区 |
| **Point Waves / Inkwell** | 水墨感 | 社区动态 / 资讯区 |
| **Uncertain Blueprint** | 不确定蓝图 | 供需市场 · 智能匹配 |

> ⚠️ Pro 集合是付费订阅内容，**仅作视觉参考**，实际实现请用 Paper Shaders 或自写 GLSL 复现同类气质。

### 4.3 竞品对标（沿用 `findings.md` §5 结论）

| 来源 | 可借鉴 | 集智差异化 |
|---|---|---|
| `opcstore.com` | 八大赋能子页统一「banner + 模块内容」模板；智能体分类 + 卡片网格 | 集智用「能量环 + 编号 01–08」强化体系感 |
| 同橙 OPC 社区（参考图 image2） | 深色科技感 Hero + 四指标横排 + 导航 | 集智 Hero 改为深藏蓝 + 极光，**不做全屏炫光**（PRD D-01） |
| `yzxcai.com` | 蓝色系为主、白底圆角卡片 | 集智深蓝 + 青绿点缀 |

---

## 5. 代码骨架

### 5.1 Hero 背景层（Paper Shaders）

```tsx
// src/components/three/HeroBackdrop.tsx
'use client'

import { MeshGradient } from '@paper-design/shaders-react'

const BRAND = ['#142F59', '#1D7FBA', '#57B6A5', '#1AA8D3'] as const

export default function HeroBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <MeshGradient
        width="100%"
        height="100%"
        colors={[...BRAND]}
        distortion={0.8}
        swirl={0.15}
        grainMixer={0}
        grainOverlay={0.1}
        speed={0.25}
        minPixelRatio={1}      // 默认 2，移动端填充率减半
        maxPixelCount={2_000_000}
      />
    </div>
  )
}
```

### 5.2 降级守卫（Paper Shaders 基于 WebGL，需自己探测）

Paper Shaders 没有 `onUnavailable` 回调，需要自建守卫：

```tsx
// src/components/three/ShaderGuard.tsx
'use client'

import { useEffect, useState, type ReactNode } from 'react'

export function hasWebGL2() {
  try {
    const c = document.createElement('canvas')
    return !!c.getContext('webgl2')
  } catch {
    return false
  }
}

export default function ShaderGuard({
  children,
  fallback,
}: {
  children: ReactNode
  fallback: ReactNode
}) {
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
    // 降低动效 / 省流量 / 低内存设备 → 走静态降级
    setOk(!reduced && !conn?.saveData && mem > 2 && hasWebGL2())
  }, [])

  if (ok === null) return <>{fallback}</>  // 首帧不挂 canvas，避免 CLS
  return <>{ok ? children : fallback}</>
}
```

> **CLS 关键**：fallback 与 canvas 必须**等尺寸**。技术方案 §7.6 要求 CLS ≤0.1，
> 若 canvas 挂载后才撑开容器会产生布局偏移。做法：外层容器固定 `aspect-*` 或 `h-[100svh]`，canvas 绝对定位铺满。

### 5.3 Next.js App Router 集成

```tsx
// src/app/page.tsx（Server Component）
import dynamic from 'next/dynamic'

// next/dynamic + ssr:false 在 App Router 必须放在 Client Component 里
const HeroBackdrop = dynamic(
  () => import('@/components/three/HeroBackdrop'),
  { ssr: false },
)
```

Paper Shaders 基于 WebGL，SSR 不渲染 canvas 即可，不强制 `ssr:false`；
但**Hero 的 three 粒子层必须 `ssr:false`**（技术方案 §7.1 已定）。

### 5.4 Paper Shaders 通用 props 备忘

| prop | 说明 |
|---|---|
| `speed` | 动画速度。`0` = 停止动画循环；`1` = `frame` 按毫秒时间戳解释 |
| `frame` | 动画起始点。`speed=1` 时是毫秒时间戳 |
| `scale` | 整体缩放，0.01–4 |
| `rotation` | 整体旋转角度，0–360 |
| `offsetX` / `offsetY` | 图形中心偏移，-1–1 |
| `width` / `height` | canvas 元素的 CSS 尺寸（number 或 string） |
| `fit` | `"contain"` \| `"cover"` |
| `worldWidth` / `worldHeight` | 缩放前的虚拟画布尺寸 |
| `originX` / `originY` | world 尺寸在画布中的参考点，0–1 |
| `minPixelRatio` | 最小像素比，**默认 2**，移动端建议设 1 |
| `maxPixelCount` | 处理的像素数上限 —— **移动端控填充率的关键参数** |

---

## 6. 降级链修订（合并技术方案 §7.7）

原方案只有一条 three 链。现在有两套引擎（Paper/WebGL + three/WebGL2），修订为：

```
① WebGL2 可用 + 设备达 high/medium 档
   → Paper 背景层 + three 粒子层 完整场景
   ↓ ② WebGL2 可用但设备 low 档（移动端 / deviceMemory≤4 / 低端 GPU）
   → Paper 背景层（低 speed、minPixelRatio=1、maxPixelCount 减半）
   → three 粒子层降到 4000 粒子 / 或整体不挂载（保留静态星点 PNG）
   ↓ ③ WebGL2 不可用 / WebGL1 可用
   → 仅 three 简化 shader（关闭部分效果），Paper 层不挂载
   ↓ ④ prefers-reduced-motion / saveData / deviceMemory≤2
   → 静态品牌渐变 + 静态星点图（Paper 侧用 StaticMeshGradient，speed=0）
   ↓ ⑤ JS 异常
   → <noscript> 风格静态占位（Hero 背景 + 文案 + CTA 完整可见）
```

**统一硬约束（沿用技术方案 §7.1 + 7.7）**：
- 任何一级降级，**Hero 文案、指标条、CTA 必须完整可见**（FR-HOME-01）
- 3D 负责气质，不负责信息；任何一条信息都不能只有 3D 形式存在
- 统一品牌色板输入，禁止彩虹色

---

## 7. 对现有技术方案的必改项

> 下列 3 条**必须修改** `docs/02-技术方案.md`，否则实现者会踩坑。

| # | 位置 | 现状 | 改为 | 依据 |
|---|---|---|---|---|
| **M1** | §7.6 性能预算表 | 「3D JS 体积 ≤180KB gzip（three + r3f 按需 tree-shake）」 | **≤270KB gzip**（three+r3f 实测 **251.6KB**）+ Paper 层 ≤15KB，合计 ≤270KB；且仅首页 Hero 异步加载 | 实测：three+r3f 具名导入 = **251.6KB gzip**，180KB 预算不可达 |
| **M2** | §7.2 组件 API / §7.4 场景 B | 场景 B 用 `TorusGeometry` + `InstancedMesh` 实现能量环 | 改用 `@paper-design/shaders-react` 的 `PulsingBorder` / `DotOrbit`，降级为 CSS `conic-gradient` | 2D 光环用 3D 引擎无收益；props 绑 state 更简单 |
| **M3** | §7.3 场景 A 背景层 | 「全屏平面 + 片元着色器：FBM（4 阶）噪声生成缓慢流动的极光带」 | 改用 `MeshGradient`（Paper Shaders），删掉手写 FBM 背景层 GLSL | 省一个 GLSL 文件 + 省 32KB 场景代码；视觉一致 |

**建议新增（非必须）**：
- §7.6 增列：`minPixelRatio={1}` + `maxPixelCount` 控填充率（Paper 默认 minPixelRatio=2，移动端填充率是 4 倍）
- §13 依赖清单：`"@paper-design/shaders-react": "^0.0.81"`（Apache-2.0，零运行时依赖）
- §11 已知风险：加一条「`@paper-design/shaders-react` 版本号 0.0.x（pre-1.0），API 可能在小版本间变动，升级前必须跑视觉回归」

---

## 8. 验收清单

| # | 验收项 | 方法 |
|---|---|---|
| V1 | 3D 全部加载体积符合修订后预算（≤270KB gzip） | `next build` 后看 `.next/static/chunks` gzip 总和；或 CI 跑 esbuild 体积门禁，基线值：three+r3f **251.6KB**、paper **11.6KB** |
| V2 | Hero 文案 / 指标 / CTA 在**每一级降级**下完整可见 | 逐级截图留证（技术方案 §7.7 已有此要求） |
| V3 | 微信内置浏览器（iOS + Android 各 ≥2 个版本）Hero 正常显示 | 真机测试；记录 `navigator.userAgent` 与 `getContext('webgl2')` 结果 |
| V4 | 安卓中低端机（deviceMemory ≤4）不卡顿、不掉帧 | Chrome DevTools 远程调试 + Performance 面板，帧率 ≥30fps |
| V5 | 首屏 LCP ≤2.5s、CLS ≤0.1 | Lighthouse 移动端（FR-SITE-05） |
| V6 | 所有 shader 颜色取自品牌色板，无彩虹色 | 代码走查 `colors` 数组 + 截图目检 |
| V7 | `prefers-reduced-motion: reduce` 时无动态效果 | 系统开启减弱动效后逐页检查 |
| V8 | 多页滚动后 GPU 上下文不泄漏（显存不持续上涨） | 长滚动 20 页后看 Chrome Task Manager GPU memory |

---

## 9. 未验证项 / 遗留风险

| # | 事项 | 状态 |
|---|---|---|
| R1 | 微信 Android XWEB 内核**当前**的 Chromium 基线版本 | ⚠️ 未实测。公开 UA 样本为 2023-10 数据（Chrome 111），XWEB 会动态更新。**必须用真机 `getContext('webgl2')` 实测**，不能假设。 |
| R2 | R1 若实测 WebGL2 不可用 | Paper 层与 three 层全部走静态降级，需保证静态视觉足够好 |
| R3 | `@paper-design/shaders-react` 在 Next.js 15 + React 19 下的 SSR / hydration 行为 | ⚠️ 未实测。Paper 组件 SSR 时应渲染空 canvas，需确认无 hydration mismatch |
| R4 | `MeshGradient` 在超大分辨率（4K / 3440×1440 带鱼屏）下的填充率表现 | ⚠️ 未实测，`maxPixelCount` 的具体阈值需按实机调 |
| R5 | `shaders`（shaders.com）的 `defineShader` / `wgsl` 为 experimental | 本期不引入，暂不适用；若未来自研 WebGPU 效果需注意 minor 版本可能破坏 API |
| R6 | ~~`docs/03-开发计划.md` 缺失~~ | ✅ **已撤销**：该文件实际存在且完整（309 行），初稿读到的是不完整目录快照。文档包 01/02/03/04 + README 齐备 |

---

## 附：参考来源

- Paper Shaders 官网与组件目录：https://shaders.paper.design/
- Paper Shaders GitHub（Apache-2.0）：https://github.com/paper-design/shaders
- Shaders（WebGPU）官网与 llms 目录：https://shaders.com/ 、https://shaders.com/llms.txt 、https://shaders.com/llms-full.txt
- WebGPU 浏览器实现状态：https://gpuweb.github.io/gpuweb/standards/status/
- 微信 H5 内核与兼容性测试实践（InfoQ / 腾讯微信事业群）：https://xie.infoq.cn/article/a2f467029030de8a834a399d0
- npm 实测数据：`shaders@4.0.4`、`@paper-design/shaders-react@0.0.81`、`three@0.186.1`、`@react-three/fiber@9.8.2`
