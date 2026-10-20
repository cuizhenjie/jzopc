# 集智 AI OPC 社区 · JIZHI · AI

> 集众智之力，启 AI 未来
> 一站式 AI 应用综合赋能平台 · 北京集美科技有限公司 · 北京丰台大红门 · 首期 3000+ ㎡

本目录当前处于 **规划阶段**：需求已从 `集智AI 网站.docx` 整理成完整文档包，尚未开始业务代码。

## 文档导航

| 文档 | 内容 |
|---|---|
| [`docs/01-需求文档.md`](docs/01-需求文档.md) | PRD：定位、用户旅程、信息架构、27 个页面清单、63 条带验收标准的功能需求、设计与 3D 动效规范、埋点与运营指标、内容缺口清单 |
| [`docs/02-技术方案.md`](docs/02-技术方案.md) | Next.js 15 + Supabase + 火山方舟 + Three.js/GLSL 的架构、数据模型 DDL、RLS 策略、3D Shader 场景实现、降级链、部署与风险 |
| [`docs/03-开发计划.md`](docs/03-开发计划.md) | 7 个里程碑、82 个可开工任务、依赖与排期、风险对策、上线验收清单、交叉复核记录 |
| [`docs/04-shader选型指南.md`](docs/04-shader选型指南.md) | 3D 动效选型：`shaders`(WebGPU) / `@paper-design/shaders-react`(WebGL) / `three+R3F` 三方案的 **esbuild 体积实测**与渲染后端核验，附品牌色映射与组件清单、降级链修订 |
| [`findings.md`](findings.md) | 从 docx 提取的原始事实、设计参考观察、品牌色板实测值、**14 项内容缺口与矛盾清单** |
| [`task_plan.md`](task_plan.md) | 规划过程的任务清单与范围决策记录 |

## 本期范围（已确认）

- **智能体**：纯展示 + 外链跳转，不做站内对话与试用
- **资源类模块**：展示 + 申请留资 + 后台线索跟进
- **账号体系**：纯官网，不做登录注册
- **交付**：需求文档 + 技术方案 + 任务拆解

## 技术栈

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + Storage + Edge Functions) · 火山引擎方舟 · Three.js + react-three-fiber (自写 GLSL 粒子) + @paper-design/shaders-react (WebGL 背景层/能量环) · Framer Motion · Vercel

## 原始素材

| 文件 | 说明 |
|---|---|
| `集智AI 网站.docx` | 业务方提供的原始需求与设计方案（含 7 张参考图） |
| `logo.svg` | 品牌 Logo 矢量图，色板由此实测得出 |

## 下一步

1. 业务方补齐 `findings.md` 第 7 节的 14 项内容缺口（其中 G1 流量超市、G8 智能体清单、G10 供需样例为高优先级）
2. 评审这四份文档，确认后按 `docs/03-开发计划.md` 的 M0 → M1 顺序开工
3. 执行 `scripts/seed-from-docx.mjs`（开发计划 T103）把 docx 文案灌入种子数据，保证文案同源
