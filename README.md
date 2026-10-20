# 集智 AI OPC 社区 · JIZHI · AI

> 集众智之力，启 AI 未来
> 一站式 AI 应用综合赋能平台 · 北京集美科技有限公司 · 北京丰台大红门 · 首期 3000+ ㎡

**代码已落地并构建通过**：Next.js 15 App Router + TypeScript + Tailwind v4 + Supabase + 火山方舟 + 自写 GLSL 粒子动效，共 **27 条路由**。

## 快速开始

```bash
pnpm install          # pnpm 12 需 pnpm-workspace.yaml 授权 onlyBuiltDependencies
pnpm dev              # 开发
pnpm build && pnpm start   # 生产（默认 3000 端口）
```

**未配置 Supabase 环境变量时自动回落本地种子数据**，开箱即可跑通全站；接真库时只需补 `.env`（见 `.env.example`，6 个变量全部可留空），调用方无需改动。

## 工程化工具

| 命令 | 作用 |
|---|---|
| `pnpm test` | Node 24 内置 runner（`node --test` + `node:assert`，**零测试依赖**），103 个用例覆盖 zod 契约、种子回落、站点配置结构、品牌色一致性 |
| `pnpm verify` | 零依赖工程校验：文档表格列数 / FR 编号悬空 / 文档文件路径悬空 / package scripts 路径 / 路由清单 vs 实际目录 / 品牌色 vs `logo.svg`。**当前 6 项全绿** |
| `pnpm db:types` | 从 `supabase/migrations/0001_init.sql` 解析生成 `src/lib/supabase/database.types.ts`（11 表 / 122 字段，可重复执行） |
| `pnpm db:smoke` | **数据库迁移冒烟测试**：自动起一次性 PostgreSQL → 逐字执行全部迁移 → 跑 **27 条断言** → 自动清理集群。一条命令，无需手工准备 |

> 测试用 Node 24 的原生 TypeScript 类型剥离直接跑 `.ts`；`@/` 路径别名由 `scripts/test-hooks.mjs` 的 resolve hook 注入（**需 Node ≥ 22.15**，仅影响本地跑测试）。

### 数据库实测（真实 PostgreSQL）

迁移脚本**曾在真实 PG 上逐字执行并通过 27 条断言**（全新安装与老库升级两条路径均通过，脚本可重复执行且自清理）：

```bash
# 一条命令：起集群 → 执行迁移 → 跑断言 → 自动清理
PG_BIN=/opt/homebrew/opt/postgresql@16/bin pnpm db:smoke
# ✓ 断言：27 通过 / 0 失败
```

底层脚本：`scripts/db-smoke.mjs`（临时集群跑完即删，不留残留）；断言文件：`supabase/tests/001_migration_smoke.sql`（可单独用 `psql -f` 跑）。

> 这次实测揪出了一个**会被本地种子回落完全掩盖**的错配：DDL 把正文列定义成 `body_md text`，而应用类型是 `body: string[]`、页面直接 `post.body.map(...)` —— 接真库时新闻详情页会抛错。现已统一为 `body jsonb`，并由 `test/db-schema-contract.test.ts` 锁死（不需要数据库也能跑）。

## 文档导航

| 文档 | 内容 |
|---|---|
| [`docs/01-需求文档.md`](docs/01-需求文档.md) | PRD v1.1：定位、用户旅程、信息架构、27 个页面清单、**65 条**带验收标准的功能需求、设计与 3D 动效规范、埋点与运营指标、内容缺口清单、§1.5 竞品定位裁决 |
| [`docs/02-技术方案.md`](docs/02-技术方案.md) | Next.js 15 + Supabase + 火山方舟 + Three.js/GLSL 的架构、数据模型 DDL、RLS 策略、3D Shader 场景实现、五级降级链、部署与风险 |
| [`docs/03-开发计划.md`](docs/03-开发计划.md) | 7 个里程碑、82 个可开工任务、依赖与排期、风险对策、上线验收清单、交叉复核记录 |
| [`docs/04-shader选型指南.md`](docs/04-shader选型指南.md) | 3D 动效选型：`shaders`(WebGPU) / `@paper-design/shaders-react`(WebGL) / `three+R3F` 三方案的 **esbuild 体积实测**与渲染后端核验，附品牌色映射与组件清单 |
| [`docs/05-全国OPC社区与商业楼宇平台竞品审查.md`](docs/05-全国OPC社区与商业楼宇平台竞品审查.md) | **结论层**：全国格局、标杆社区逐一拆解、7 家楼宇/园区平台可借鉴点与视觉风格实测、行业标配 vs 差异化机会、集智定位裁决、首页 5 个信息点、15 项信息缺口 |
| [`docs/05-全国OPC社区与商业楼宇平台竞品事实.md`](docs/05-全国OPC社区与商业楼宇平台竞品事实.md) | **证据层**（1244 行）：14 节事实底稿，每条标注来源与 URL，冲突口径并列不做单方裁决 |
| [`docs/06-视觉方案与3D动效规范.md`](docs/06-视觉方案与3D动效规范.md) | 视觉总纲、色彩系统、排版栅格、3D 粒子动效规范（含实测调优后的最终参数）、页面级视觉矩阵、组件规范、可访问性与验收清单 |
| [`findings.md`](findings.md) | 从 docx 提取的原始事实、品牌色板实测值、**14 项内容缺口与矛盾清单**（G13 已补 docx 原文证据） |
| [`task_plan.md`](task_plan.md) | 规划过程的任务清单与范围决策记录 |

## 已实现的页面

`/` · `/about` `/about/history` `/about/audience` `/about/partners` · `/empower/[slug]`（8 个赋能页） · `/agents` `/agents/[slug]` · `/market` `/market/[slug]` · `/academy` `/academy/courses/[slug]` · `/news` `/news/[slug]` · `/traffic` · `/apply` · `/ops/leads`（线索看板） · `/api/leads`（留资） · `/api/ops/leads`（线索状态） · `/api/og`（动态分享图 1200×630） · `sitemap.xml` `robots.txt` · `not-found`

## 质量基线（实测）

| 项 | 结果 |
|---|---|
| Lighthouse | **可访问性 100 · 最佳实践 100 · SEO 100 · Agentic Browsing 100**（首页 / apply / academy / agents / market / news / 供需详情页逐页实测，全部 0 失败） |
| 浏览器控制台 | 0 错误 0 警告 |
| 滚动揭示 | 19/19 正确触发，服务端直出可见（不依赖 JS） |
| 3D Hero | WebGL 2.0，粒子层自写 GLSL，canvas 随视口等比缩放 |
| 测试 | `pnpm test` → **119 pass / 0 fail**（含 DDL 契约校验 + 3D 降级链结构约束） |
| 3D 降级链 | **逐级实测留证**：①完整 12000 粒子 / ②轻量 2500 粒子 / ③无 WebGL2 静态档 / ④减弱动效静态档 / ⑤无 JS 服务端 HTML 完整 —— 每一级 Hero 文案与 CTA 均可见 |
| 数据库 | 迁移脚本在真实 PostgreSQL 上逐字执行通过，冒烟测试 **27/27**（全新安装 + 老库升级两条路径） |
| 校验 | `pnpm verify` → 6 项全绿 |
| 构建 | `pnpm build` → 62 个静态页，**全部公开页面为静态/SSG** |
| 路由 | 69 个 URL（含 54 个动态页）全部 200，未知路径 404 |
| metadata | 18 个公开页面的 `<title>` / `<meta description>` **全部落在 `<head>` 内** |

## 关键实现决策

| 议题 | 裁决 | 理由 |
|---|---|---|
| 智能体 | 纯展示 + 外链跳转 | 本期不做站内对话/试用（范围已确认） |
| 3D 方案 | 粒子层自写 GLSL（three+R3F 251.6KB gzip）+ 背景层用 Paper `MeshGradient`（11.6KB gzip） | **`shaders@4.0.4` 是 WebGPU-only（727.5KB gzip）且无 WebGL 降级**，微信内置浏览器大概率透明 |
| 降级链 | 五级分叉：完整 → 低档 → 仅 three → 静态 → 无 JS | fallback 与 canvas 必须等尺寸，防 CLS |
| 数据层 | Supabase 优先，未配置自动回落种子数据 | 开箱可跑，接真库不改调用方 |
| 后台线索 | `/ops/leads` 用 `OPS_TOKEN` + `timingSafeEqual` + `service_role` | 已登记为技术债 R1，二期换 Supabase Auth + 角色表 |
| RLS | `leads` 表**零 anon insert 策略**；`site_stats`/`agent_categories` 无 `published` 列、`news_posts` 用 `status` | 逐表显式策略，见 `supabase/migrations/0002_rls.sql` |
| 滚动揭示 | 服务端可见 + 客户端渐进增强 | framer-motion `whileInView` 会让 SSR HTML 里内容 `opacity:0` |
| 列表页渲染 | **静态渲染 + 客户端筛选**（`FilterRoot` / `FilterLink`） | 列表页若在服务端 `await searchParams` 会走动态渲染，Next.js 把 `<title>`/`<meta description>` flush 到 `</body>` 之后，**搜索引擎读不到**（实测 3 个页面中招）；改为服务端渲染全部条目 + 客户端过滤后，全部公开页面的 metadata 都回到 `<head>` |
| 浅底可读蓝 | `--color-brand-blue-deep` = `#0968AB`（品牌渐变起始色） | 主蓝 `#1D7FBA` 在白底仅 4.38:1，达不到 AA 正文 4.5:1；详见 `docs/06` §2.3 |
| OG 图中文字体 | Noto Sans SC **子集版 1.71MB**（GB2312 全集 + 拉丁 + 标点 + 全角） | `next/og` 自带字体只有拉丁字符，中文会变豆腐块；子集化把函数包体积降 78.5%，许可与子集说明见 `src/app/api/og/fonts/OFL.txt` |
| 后台口令 | `/ops/leads` 用 `OPS_TOKEN` + `timingSafeEqual` + `service_role` | 已登记为技术债 R1，二期换 Supabase Auth + 角色表；**口令绝不进 URL**（邮件通知只给看板地址） |
| 种子数据 | 智能体/合作企业为**明确标注的示例数据** | 不臆造真实合作方与智能体清单，正式清单待业务方采集替换 |
| 数据访问 | Supabase 优先，未配置自动回落种子；**回落会掩盖列名错配**，故由 `test/db-schema-contract.test.ts` + 真实 PG 冒烟测试双重兜底 | 本地「一切正常」不代表接真库也正常 —— 2026-10-20 的 `body_md` 错配就是这么藏了很久 |
| 数据库授权 | `0002_rls.sql` 里**显式**写 grant，不依赖 Supabase 平台默认值 | 迁移自洽、换自建 Postgres 不漏授权，也才能在裸 PG 上验证 RLS |
| 3D 降级 | 严格 WebGL2 探测 + `ThreeErrorBoundary` 错误边界 + `HeroScene` 允许 SSR | three r163+ 只支持 WebGL2；探测不严会挂载必炸的 three，而未捕获异常会**把整个 Hero 连同 H1 与 CTA 一起卸载**。详见 `docs/06` §4.3 |

## 本期范围（已确认）

- **智能体**：纯展示 + 外链跳转，不做站内对话与试用
- **资源类模块**：展示 + 申请留资 + 后台线索跟进
- **账号体系**：纯官网，不做登录注册

## 技术栈

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + Storage) · 火山引擎方舟 · Three.js + react-three-fiber（自写 GLSL 粒子）+ @paper-design/shaders-react（WebGL 背景层） · Vercel

## 原始素材

| 文件 | 说明 |
|---|---|
| `集智AI 网站.docx` | 业务方提供的原始需求与设计方案（含 7 张参考图） |
| `logo.svg` | 品牌 Logo 矢量图，色板由此实测得出 |

## 待业务方闭环

1. **14 项内容缺口**（`findings.md` §7）——G1 流量超市整块内容、G8 智能体清单、G10 供需样例数据为高优先级，直接卡住对应模块上线
2. **G12 口径**：申请入驻页原文写「九大创业赋能资源」，已按八大修正，需拍板
3. **G13 命名**：「订单市场」vs「供需市场」——已定位到 docx 两处不同用法（`findings.md` G13 附证据表），待拍板
4. **G14 授权**：16 家合作企业 logo 的真实性与授权待确认
5. **对外主标**：「不只是八个服务，是一条从工位到订单的链」是否采用
6. **价格与指标口径**（竞品审查 R9/R10）：工位费/免租时长/水电口径、四项指标的可核查口径
7. **实机调研**（竞品审查 R1–R15）：同橙 opcstore 线上 Store 形态、OPC 社区官网存在情况、商业楼宇 3D 看楼能力
