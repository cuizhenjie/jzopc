# 18 · 管理后台 App Shell 与编辑便利性契约

> 2026-10-27 后台布局重构的架构契约。后台从「每页一张居中卡片」改为 opendesign 后台模板的
> **左右两栏 App Shell**（左固定菜单 + 右顶栏/功能区独立滚动），视觉层以项目内
> shaders 组件（`@paper-design/shaders-react`）为主。本文记录必须维持的结构事实与红线，
> 后续改后台先读这里。

## 1. 布局结构（谁渲染什么）

| 层 | 文件 | 职责 |
|---|---|---|
| 持久壳 | `src/app/admin/layout.tsx` → `src/components/admin/shell/AdminChrome.tsx` | 服务端取一次会话；客户端壳：左侧栏 + 顶栏 + 功能区。**页面间导航不重挂载壳**（WebGL canvas 不重建） |
| 导航唯一事实源 | `src/components/admin/shell/admin-nav.ts` | 5 组 14 项导航树 + `findNavByPath` / `findNavByKey`。侧栏高亮、顶栏面包屑、子页返回链接三处都从这里派生，**不得另抄一份菜单** |
| 图标 | `src/components/admin/shell/AdminIcons.tsx` | 内联 SVG（Lucide 风格 24 视口 stroke 1.75）。**不新增图标库依赖** |
| 页头 | `src/components/admin/AdminShell.tsx`（瘦身后） | 只渲染当前页标题区；`active/title/desc/actions/dbConfigured` props 与旧版完全兼容，**32 个 admin 页面因此零改动**。新增页面继续用它，不要绕开 |

- 布局变量定义在 `globals.css` 的 `.admin-app` 作用域：`--admin-sidebar-w: 248px`、
  `--admin-sidebar-w-collapsed: 72px`、`--admin-topbar-h: 56px`。crud 表单的粘性元素引用
  **必须带兜底**：`var(--admin-topbar-h, 56px)`。
- 滚动容器是右栏的 `section[aria-label="功能区"]`（`overflow-y: auto`），不是 window——
  表单吸底栏（`sticky bottom-3`）与侧栏吸顶都基于它。壳内**禁止再出现 `<main>`**
  （根布局 `SiteChrome` 已渲染全文档唯一 `main`）。
- 侧栏 `<aside>` 桌面态必须是 `relative`：内部 `ShaderBackdrop` 是 `absolute inset-0`，
  `static` 会让 shader 锚到整个 `.admin-app` 全宽渲染（已踩过，见 AdminSidebar 注释）。
- 登录页 `/admin/login` 由 `AdminChrome` 按 pathname 旁路（不套壳），视觉不变。
- 折叠偏好存 `localStorage['jz-admin-sidebar']`；移动端（<lg）侧栏是离屏抽屉，
  折叠态不生效；抽屉开时锁 body 滚动、Esc/路由变化自动关闭。

## 2. shaders 预算（红线）

同屏 `MeshGradient` **≤ 3**：侧栏 `ShaderBackdrop variant="sidebar"`（深海军蓝低速，
左栏主视觉）+ 右栏 `variant="shell"`（极浅）+ 页头 `ShaderAccent`。
KPI 卡、表格、表单等**一律不挂 shader**（浏览器 WebGL 上下文上限 ≈ 8–16）。
三级降级链（WebGL → reduced-motion 静帧 → CSS 渐变兜底）由
`src/components/shaders/ShaderBackdrop.tsx` / `ShaderAccent.tsx` 统一提供，新场景加变体，
不要各页面手写 WebGL。

## 3. 编辑便利性组件契约

- `src/components/admin/crud/ui.tsx`：
  - `FormCard { title?, desc? }` —— 双栏表单分区语义（内容 / 发布设置 / 链接与封面）。
  - `SubmitBar` —— 吸底操作栏（`data-testid="form-action-bar"`），`dirty` 显示
    「有未保存的修改」琥珀点，常驻提示 `⌘/Ctrl + S 保存`。
- `src/components/admin/crud/use-form-guards.ts`：
  - `useFormGuards({ formRef, dirty, busy })` —— ⌘/Ctrl+S 走 `form.requestSubmit()`；
    脏数据挂 `beforeunload` 守卫（提交中不挂，避免保存成功误弹窗）。
  - `scrollToFirstError(errors, idPrefix, idFor?)` —— 校验失败滚到首个出错字段并聚焦；
    错误键 ≠ 控件 id 时由调用方传 `idFor` 映射（如 NewsForm 的 `bodyHtml → nf-body`）。
- 脏检测 = 与**挂载时初始快照**的 JSON 序列化对比（NewsForm 存 ref 快照）。
  表单新增字段时无需改脏检测。
- `ResourceTable { toolbar?, countLabel? }` —— 卡片头常驻「共 N 条」+ 右侧工具位。

## 4. 与契约测试的相容点（改后台前必读）

- `test/brand-palette.test.ts`：hex 只允许 logo 色板 ∪ 中性阶梯 ∪ 语义红；组件样式一律
  用 `var(--color-*)` token（含遮罩这类带 `/透明度` 的写法）。
- `test/market-search.test.ts`：全站 `src/**` **禁止出现 `type="search"` 输入框**
  ——顶栏快速跳转（QuickJump）因此用 `type="text" + role="combobox"`；
  ⚠️ 连 JSX 标签内的注释写了 `type="search"` 字样都会被扫中（正则 `[^>]*` 跨行）。

## 5. 验收基线（2026-10-27）

typecheck 0 错；全量测试 316/316（Node 24）；`pnpm verify` 6/6；Playwright 实测
（隔离 dev + OPS_TOKEN 主口令登录）：侧栏 248px/折叠 72px 且 canvas 随宽、顶栏 56px sticky、
同屏 canvas=3、吸底栏滚底仍在视口、⌘S 触发提交并定位错误字段、折叠跨刷新持久、
移动端抽屉开/关/路由自动收起、390px 无横向溢出、reduced-motion 正常。
