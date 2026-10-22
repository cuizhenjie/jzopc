# OPC Store · 科技蓝全站复现

当前前台按用户于2026-10-22指定的 [OPC Store](https://opcstore.com/webNew/index.html#/) 复现公开布局与文案。包括20个页面模板、233个工具条目、44个南京社区与158条公开内容详情；导航、筛选、分页、弹窗及账号表单界面使用本地实现。

```bash
pnpm install
pnpm dev
# 或 pnpm build && pnpm start
```

无需原站接口即可展示内容。账号、验证码与申请服务尚未接入；有效字段校验不会伪报提交成功。源站失效图标及受限站外正文图采用本地占位图。独立子站继续保留外链。现有后台与线索API独立保留。

源数据在 `scripts/opc-source/`，内容可用 `pnpm opc:content` 重新净化生成，样式可用 `pnpm opc:styles` 离线重生；普通构建直接使用已生成内容及本地素材。详细范围、运行方式和验收证据见 [科技蓝复现报告](docs/11-OPC参考站科技蓝复现.md)。

---

以下为此前集智官网的历史工程说明，当前公开页面与内容范围以上述复现版本为准。

# 集智 AI OPC 社区 · JIZHI · AI

> 集众智之力，启 AI 未来
> 一站式 AI 应用综合赋能平台 · 北京集美科技有限公司 · 北京丰台大红门 · 首期 3000+ ㎡

**代码已落地并构建通过**：Next.js 15 App Router + TypeScript + Tailwind v4 + Supabase + 火山方舟 + 自写 GLSL 粒子动效，共 **73 个公开 URL**（18 个页面路由 + 4 个业务 API + llms 摘要 + robots/sitemap）。

## 快速开始

```bash
pnpm install          # pnpm 12 需 pnpm-workspace.yaml 授权 onlyBuiltDependencies
pnpm dev              # 开发
pnpm build && pnpm start   # 生产（默认 3000 端口）
```

**未配置 Supabase 环境变量时自动回落本地种子数据**，开箱即可跑通全站；接真库时只需补 `.env`（见 `.env.example`，6 个变量全部可留空），调用方无需改动。

### 裸机部署（不依赖 Docker，只要 Node ≥20）

```bash
# 构建机：域名必须在**构建期**带上（NEXT_PUBLIC_* 是内联的）
NEXT_PUBLIC_SITE_URL=https://t.3cool.cc pnpm build:deploy   # standalone 产物
pnpm prepare:deploy                                       # 组装自包含的 deploy/ 目录（约 68 MB）

# 服务器：只要 node ≥20，不要 pnpm、不要源码、不要项目 node_modules
cd deploy && PORT=3000 HOSTNAME=127.0.0.1 NODE_ENV=production node server.js
# 或用进程守护：cd deploy && pm2 start pm2.config.cjs && pm2 save
```

`pnpm prepare:deploy` 会**逐项校验**产物完整性（server、字体、static、public），缺件直接退出非零 —— 这些缺件在线上都不报错，只会表现成「整站白屏」「分享图中文变方块」。详见 [`docs/02-技术方案.md`](docs/02-技术方案.md) §10.2。

## 工程化工具

| 命令 | 作用 |
|---|---|
| `pnpm test` | Node 24 内置 runner（`node --test` + `node:assert`，**零测试依赖**），**193 个用例**覆盖 zod 契约、种子回落、站点配置结构、品牌色一致性、搜索匹配规则与静态渲染红线 |
| `pnpm verify` | 零依赖工程校验：文档表格列数 / FR 编号悬空 / 文档文件路径悬空 / package scripts 路径 / 路由清单 vs 实际目录 / 品牌色 vs `logo.svg`。**当前 6 项全绿** |
| `pnpm db:types` | 从 `supabase/migrations/0001_init.sql` 解析生成 `src/lib/supabase/database.types.ts`（11 表 / 122 字段，可重复执行） |
| `pnpm db:smoke` | **数据库迁移冒烟测试**：自动起一次性 PostgreSQL → 逐字执行全部迁移 → 跑 **27 条断言** → 自动清理集群。一条命令，无需手工准备 |
| `node scripts/responsive-audit.mjs` | **响应式审计器**（零依赖，驱动 headless Chrome over CDP）：18 页 × 375/768/1024/1440 = **72 组合**，量横向溢出 / 越界元素 / 小字 / 触控目标 / 文本硬裁，产出 JSON + 截图 |

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
| [`docs/07-UI优化与性能验收.md`](docs/07-UI优化与性能验收.md) | UI 与性能优化轮次：设计转向（单画布、编辑式排版、延后加载）、本轮性能基线与**逐条实测结果**（含「本机 ≠ 公网」的测量条件说明） |
| [`docs/08-roadmap.md`](docs/08-roadmap.md) | **产品与技术路线图**：里程碑总览、上线阻塞项（内容缺口 / 待输入 / 待拍板）、可直接开工项、技术债、实机调研清单 |
| [`docs/09-生产环境复核报告.md`](docs/09-生产环境复核报告.md) | 对《整改优化开发 MVP 计划 v2》的**生产环境复核**：三轮实测、34 项声明逐条核验、13 处数字修订、5 条文档未覆盖的重要事实（生产已有活着的 R3F 粒子层 / 部署形态是 Coze FaaS 非 Docker / partners 页同样纯文字 / admin 后台未上线 / 路由已分叉） |
| [`docs/10-代码审查与整改报告出入分析.md`](docs/10-代码审查与整改报告出入分析.md) | **代码层审查**：整改计划 S0–S5 逐项对代码现状，结论是「S0 代码早已修好、真正缺的是一次发布」；纠正原报告 2 处误判（S2-2 早已实现、JSON-LD 已绝对化）、列出 3 处漏判、给出修订排期与新的优先级排序 |
| [`docs/06-视觉方案与3D动效规范.md`](docs/06-视觉方案与3D动效规范.md) | 视觉总纲、色彩系统、排版栅格、3D 粒子动效规范（含实测调优后的最终参数）、页面级视觉矩阵、组件规范、可访问性与验收清单 |
| [`findings.md`](findings.md) | 从 docx 提取的原始事实、品牌色板实测值、**14 项内容缺口与矛盾清单**（G13 已补 docx 原文证据） |
| [`task_plan.md`](task_plan.md) | 规划过程的任务清单与范围决策记录 |

## 已实现的页面

`/` · `/about` `/about/history` `/about/audience` `/about/partners` · `/empower/[slug]`（8 个赋能页） · `/agents` `/agents/[slug]` · `/market` `/market/[slug]` · `/academy` `/academy/courses/[slug]` · `/news` `/news/[slug]` · `/traffic` · `/apply` · `/search`（站内搜索） · `/admin` `/admin/login` `/admin/leads` `/admin/news`（管理后台，管理员账号登录 + shader 背景层，noindex） · `/ops/leads`（旧看板 → 301 跳转 `/admin/leads`） · `/api/leads`（留资） · `/api/admin/session`（后台登录/登出） · `/api/admin/leads/[id]`（线索状态/备注/删除） · `/api/admin/leads/export`（线索 CSV） · `/api/admin/news[/id]`（新闻 CRUD） · `/api/search`（站内检索） · `/api/og`（动态分享图 1200×630） · `sitemap.xml` `robots.txt` · `not-found`

## 质量基线（实测）

| 项 | 结果 |
|---|---|
| Lighthouse | **可访问性 100 · 最佳实践 100 · SEO 100 · Agentic Browsing 100**（首页 / apply / academy / agents / market / news / 供需详情页逐页实测，全部 0 失败） |
| 浏览器控制台 | 0 错误 0 警告 |
| 滚动揭示 | 19/19 正确触发，服务端直出可见（不依赖 JS） |
| 3D Hero | WebGL 2.0，粒子层自写 GLSL，canvas 随视口等比缩放 |
| 测试 | `pnpm test` → **178 pass / 0 fail**（含 DDL 契约校验 + 3D 降级链结构约束 + 品牌色板约束 + 搜索匹配规则与静态渲染红线） |
| 响应式 | **72/72 组合 0 问题**（18 页 × 4 断点）：无横向滚动、无越界元素、无文本硬裁、触控目标全部 ≥ WCAG AA 24×24、含中文的小字 0 处 |
| 3D 降级链 | **逐级实测留证**：①完整 12000 粒子 / ②轻量 2500 粒子 / ③无 WebGL2 静态档 / ④减弱动效静态档 / ⑤无 JS 服务端 HTML 完整 —— 每一级 Hero 文案与 CTA 均可见 |
| 数据库 | 迁移脚本在真实 PostgreSQL 上逐字执行通过，冒烟测试 **27/27**（全新安装 + 老库升级两条路径） |
| 校验 | `pnpm verify` → 6 项全绿 |
| 构建 | `pnpm build` → 74 个静态页，**全部公开页面为静态/SSG** |
| 路由 | 73 个公开 URL 全部 200（`/api/leads`、`/api/ops/leads` 为 POST-only，GET 返回 405 属预期），未知路径 404 |
| metadata | 66 个公开页面（含 54 个动态页）的 `<title>` / `<meta description>` **全部落在 `<head>` 内** |

## 关键实现决策

| 议题 | 裁决 | 理由 |
|---|---|---|
| 智能体 | 纯展示 + 外链跳转 | 本期不做站内对话/试用（范围已确认） |
| 3D 方案 | 粒子层自写 GLSL（three+R3F 251.6KB gzip）+ 背景层用 Paper `MeshGradient`（11.6KB gzip） | **`shaders@4.0.4` 是 WebGPU-only（727.5KB gzip）且无 WebGL 降级**，微信内置浏览器大概率透明 |
| 降级链 | 五级分叉：完整 → 低档 → 仅 three → 静态 → 无 JS | fallback 与 canvas 必须等尺寸，防 CLS |
| 数据层 | Supabase 优先，未配置自动回落种子数据 | 开箱可跑，接真库不改调用方 |
| 后台线索 | `/admin` 管理后台（线索/新闻 CRUD）用**管理员账号**（`admin_users` 表，scrypt 密码）+ HMAC 签名 httpOnly 会话 + `service_role`，登录带 IP 限流；OPS_TOKEN 降级为恢复主口令通道 | R1 的账号化已落地；多角色细粒度权限留给后续 |
| RLS | `leads` 表**零 anon insert 策略**；`site_stats`/`agent_categories` 无 `published` 列、`news_posts` 用 `status` | 逐表显式策略，见 `supabase/migrations/0002_rls.sql` |
| 滚动揭示 | 服务端可见 + 客户端渐进增强 | framer-motion `whileInView` 会让 SSR HTML 里内容 `opacity:0` |
| 列表页渲染 | **静态渲染 + 客户端筛选**（`FilterRoot` / `FilterLink`） | 列表页若在服务端 `await searchParams` 会走动态渲染，Next.js 把 `<title>`/`<meta description>` flush 到 `</body>` 之后，**搜索引擎读不到**（实测 3 个页面中招）；改为服务端渲染全部条目 + 客户端过滤后，全部公开页面的 metadata 都回到 `<head>` |
| 浅底可读蓝 | `--color-brand-blue-deep` = `#0968AB`（品牌渐变起始色） | 主蓝 `#1D7FBA` 在白底仅 4.38:1，达不到 AA 正文 4.5:1；详见 `docs/06` §2.3 |
| OG 图中文字体 | Noto Sans SC **子集版 1.71MB**（GB2312 全集 + 拉丁 + 标点 + 全角） | `next/og` 自带字体只有拉丁字符，中文会变豆腐块；子集化把函数包体积降 78.5%，许可与子集说明见 `src/app/api/og/fonts/OFL.txt` |
| 后台口令 | `/admin/login` 支持**管理员账号**（用户名+scrypt 密码，`pnpm admin:create` 建号/改密/停用）与 **OPS_TOKEN 恢复主口令**两条通道；会话为 HMAC 签名自包含 token（7 天），cookie 不含任何口令；登录接口 15 分钟 5 次 IP 限流；`admin_users` 表 RLS 零策略（仅 service_role 可读） | 密码只存 scrypt 哈希；密钥轮换自动使全部会话失效；**口令绝不进 URL**（通知邮件只给后台地址） |
| 种子数据 | 智能体/合作企业为**明确标注的示例数据** | 不臆造真实合作方与智能体清单，正式清单待业务方采集替换 |
| 数据访问 | Supabase 优先，未配置自动回落种子；**回落会掩盖列名错配**，故由 `test/db-schema-contract.test.ts` + 真实 PG 冒烟测试双重兜底 | 本地「一切正常」不代表接真库也正常 —— 2026-10-20 的 `body_md` 错配就是这么藏了很久 |
| 数据库授权 | `0002_rls.sql` 里**显式**写 grant，不依赖 Supabase 平台默认值 | 迁移自洽、换自建 Postgres 不漏授权，也才能在裸 PG 上验证 RLS |
| 3D 降级 | 严格 WebGL2 探测 + `ThreeErrorBoundary` 错误边界 + `HeroScene` 允许 SSR | three r163+ 只支持 WebGL2；探测不严会挂载必炸的 three，而未捕获异常会**把整个 Hero 连同 H1 与 CTA 一起卸载**。详见 `docs/06` §4.3 |
| 卡片层级 | **两档制**：主卡 16px+阴影+抬升 / 次级卡 12px+描边**无阴影** | 「所有卡片统一圆角+阴影」这条旧规范本身是「AI 生成感」的制度性根因。详见 `docs/06` §2.4 |
| 八大赋能 | **6 个链路节点 + 2 项贯穿支撑**（学院/企服） | 消除「文案说是一条链、视觉却是八张同款并列卡」的自相矛盾；8 个详情页仍全部可达 |
| 数据层回落 | 区分「未配置库」（回落种子）/「查询报错」（回落）/「已配置但为空」（**不回落**） | 回落会掩盖「已下架」与「真·空态」语义。详见 `findings.md` G21–G22 |

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

## 面向 AI 的站点摘要

- **`/llms.txt`**（别名 `/llm.txt`）：按 [llmstxt.org](https://llmstxt.org) 规范生成的站点摘要，**由 `src/lib/site/config.ts` 自动生成** —— 改导航、改文案即同步，不会出现「过期的摘要把 AI 引向不存在的入口」。
- 内容包含：关键事实、八大赋能（8 项各带链接与说明）、主要入口、智能体市场、供需市场、集智商学院、优势与愿景、关于集智、留资路径。
- **诚实性优先**：明确标注智能体与合作企业为示例数据、不提供登录注册与站内对话、内容未就绪的页面列出为「内容筹备中」。
- 可发现性：`head` 里 `<link rel="alternate" type="text/plain" href="/llms.txt">`；`robots.txt` 显式放行；`test/llms-txt.test.ts` 锁死规范结构与「与站点内容同源」。

## 待业务方闭环（完整清单见 `docs/08-roadmap.md`）

1. **14 项内容缺口**（`findings.md` §7）——G1 流量超市整块内容、G8 智能体清单、G10 供需样例数据为高优先级，直接卡住对应模块上线
2. **G12 口径**：申请入驻页原文写「九大创业赋能资源」，已按八大修正，需拍板
3. **G13 命名**：「订单市场」vs「供需市场」——已定位到 docx 两处不同用法（`findings.md` G13 附证据表），待拍板
4. **G14 授权**：16 家合作企业 logo 的真实性与授权待确认
5. **对外主标**：「不只是八个服务，是一条从工位到订单的链」是否采用
6. **价格与指标口径**（竞品审查 R9/R10）：工位费/免租时长/水电口径、四项指标的可核查口径
7. **实机调研**（竞品审查 R1–R15）：同橙 opcstore 线上 Store 形态、OPC 社区官网存在情况、商业楼宇 3D 看楼能力
