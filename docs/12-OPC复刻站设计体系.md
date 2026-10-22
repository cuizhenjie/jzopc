# OPC 复刻站 · 设计体系规范

| 项 | 内容 |
|---|---|
| 版本 | v1.0 |
| 日期 | 2026-10-22 |
| 关联 | `docs/06-视觉方案与3D动效规范.md`（主站规范）、`docs/11-OPC参考站科技蓝复现.md`（复现范围）、`src/styles/opc-tokens.css`、`src/styles/opc-components.css` |
| 目标 | 把复刻页从「原站 CSS 机器改色」升级为「有设计体系的站点」，且不改动既有功能结构 |

---

## 0. 为什么要另起一套体系

上一轮的「科技蓝复现」把参考站 CSS 逐条机器改色（`public/opc/reference-blue.css`，390KB）。
色相换对了，但**设计体系没有建立** —— 实测（`scripts/opc-design-audit.mjs`）：

| 维度 | 复现态 | 重设计后 | 收敛依据 |
|---|---|---|---|
| 字号档位 | 32 档（11 → 130px） | 8 档 + 1 数字档 | `opc-tokens.css` 的 `--opc-fs-*` |
| 字重档位 | 6 档 | 3 档 | `--opc-fw-normal/medium/bold` |
| 文字色 | 24 档 | 5 档 | `--opc-ink*` |
| 背景色 | 11 档 | 4 档 | `--opc-surface*` |
| padding 组合 | 38 种 | 收敛到 `--opc-space-*` 8 档 | 4px 基准 |
| 圆角 | 11 档 | 4 档 | `--opc-radius-*` |
| 阴影 | 14 种 | 2 档 | `--opc-shadow-lift/overlay` |
| 标题层级 | 每页各不相同 | 全站统一 h1:32 / h2:24 / h3:19 | — |

**结论**：复现态的页面「结构对、观感不对」—— 因为原站的排版尺度、色彩层级、
控件规格是按另一套（模板站的）规则组织的，机器改色只换掉了颜色。

---

## 1. 色彩系统

### 1.1 Token

全部取自项目根目录 `logo.svg` 实测值（与 `globals.css` 同源），**不得臆造新色**。
约束由 `test/brand-palette.test.ts` 与 `test/opc-design-system.test.ts` 双重守护。

| Token | 值 | 用途 |
|---|---|---|
| `--opc-blue` | `#1d7fba` | 边框、图标、渐变端点、**大字**（≥24px） |
| `--opc-blue-deep` | `#0968ab` | **浅底可读蓝**：小字链接、填充按钮、编号 |
| `--opc-blue-dark` | `#0e3769` | 深色渐层底、hover 态 |
| `--opc-navy` | `#142f59` | 深色区块底、页脚 |
| `--opc-cyan` | `#1aa8d3` | 深底高亮、焦点环 |
| `--opc-teal` | `#57b6a5` | 深底点缀 |
| `--opc-ink` | `#1a2333` | 正文与标题主色（13.2:1） |
| `--opc-ink-2` | `#4d5153` | 次级正文（8.0:1） |
| `--opc-ink-3` | `#5f6878` | 辅助信息（5.6:1） |
| `--opc-ink-muted` | `#5f6878` | 占位符 / 禁用态 |
| `--opc-surface` | `#f6f9fc` | 页面底 |
| `--opc-surface-2` | `#eef4fa` | 次级区块底 |
| `--opc-surface-blue` | `#eef4fa` | 品牌浅底（选中态 / 提示条） |
| `--opc-line` | `#e3e9f2` | 分割线、卡片描边 |
| `--opc-danger` | `#b42318` | 唯一的语义色（错误提示） |

### 1.2 硬规则

1. **浅底小字只用 `--opc-blue-deep`**。`--opc-blue` 在白底仅 4.38:1，达不到 AA 正文 4.5:1。
2. **深底上的字用白 / 半透明白分层**，不用纯白铺满。
3. **一个强调色**：每屏最多一个品牌蓝实心 CTA，其余用描边或文字链。
4. **单页深色面积 ≤ 40%**。
5. **禁止彩虹色**：渐变端点只能取自上表。

> 浅底小字与白字承载色的完整对比度实测见 `docs/06` §2.3，本轮继承该结论，
> 并由 `scripts/opc-contrast.mjs` 在**真实像素**上复跑（见 §7）。

---

## 2. 排版体系

| 项 | 规则 |
|---|---|
| 字体 | 系统中文栈（PingFang SC / 微软雅黑 / Noto Sans CJK SC），**不加载 Web Font** |
| 数字字体 | `SF Mono` 等宽，用于指标数字、日期（`font-variant-numeric: tabular-nums`） |
| 容器 | 最大 1280px，水平 padding 24px（移动 20px） |
| 栅格 | 12 列；卡片网格 4（桌面）/ 2（平板）/ 1–2（移动） |
| 行高 | 标题 1.2–1.35；正文 1.8 |
| 标题层级 | 每页只允许一个 H1；区块标题 H2；卡片标题 H3 |
| 最小字号 | **12px**。11px 由 `test/opc-design-system.test.ts` 硬性拦截 |

### 2.1 字号阶（8 档 + 1 数字档）

```
--opc-fs-display  40px   首页主视觉标题
--opc-fs-h1       32px   页面主标题
--opc-fs-h2       24px   区块标题
--opc-fs-h3       19px   卡片标题
--opc-fs-num      34px   指标数字（等宽，独立于标题族）
--opc-fs-body     15px   正文
--opc-fs-sm       13px   次级信息 / 标签 / 导航
--opc-fs-xs       12px   辅助信息 / 计数
```

### 2.2 字重（3 档）

`--opc-fw-normal: 400` · `--opc-fw-medium: 500` · `--opc-fw-bold: 700`

原站的 800 / 900 全部收敛到 700 —— 超粗字重是模板站的典型特征。

### 2.3 字号阶收口（实测）

`scripts/opc-design-audit.mjs` 会统计全站字号档位，并**点名**每一个落在阶外的元素
（出现页数 + 样例文本）—— 只给数字没法收口。

收口过程：

| 轮次 | 字号档位 | 阶外元素处理 |
|---|---|---|
| 复现态 | **32 档**（11 → 130px） | — |
| 本轮初始 | 27 档 | — |
| 第一批收口后 | 25 档 | 页脚链接、日期、价格、课程 meta、地址、统计标签、页脚标签、正文行内字号 |
| 第二批收口后 | **22 档** | 活动徽标 11px → 12px、必填星号 → 12px、特性行 → 15px、按钮 → 15px |

**现在的分布**：

```
主体（占 96%）：12px ×773  13px ×950  15px ×609  19px ×461  24px ×63  32px ×18
阶外（有意保留）：18px 品牌字 / 20px 单位 / 28px 步骤号 / 30px、42px 指标数字
                  64–130px 水印与装饰编号（.oc-watermark / .ac-watermark / .eco-num）
```

**11px 已归零**（原站 `.spec-label`、`.ec-badge` 都是 11px，低于本站 12px 下限）。
剩下的阶外字号全部是**展示型数字与装饰水印**，属于有意为之。

> 审计脚本现在会打印「字号阶之外」清单与「尾巴元素明细」，
> 后续再出现新的阶外字号时可以直接按清单逐条补，
> 不需要靠肉眼扫页面。

---

## 3. 间距栅格

4px 基准，8 档：

```
--opc-space-1    4px    --opc-space-6    24px
--opc-space-2    8px    --opc-space-8    32px
--opc-space-3   12px    --opc-space-12   48px
--opc-space-4   16px    --opc-space-16   64px
```

区块之间留白 `--opc-section-gap: 72px`（移动端 48px）。

---

## 4. 圆角与阴影

| 档 | Token | 值 | 用途 |
|---|---|---|---|
| 标签 / 输入框 | `--opc-radius-tag` | 4px | 标签、输入框 |
| 按钮 / 导航 | `--opc-radius-control` | 8px | 按钮、导航项 |
| 卡片 / 面板 | `--opc-radius-panel` | 12px | 列表卡片、面板 |
| 主卡 / 区块容器 | `--opc-radius-card` | 16px | 主卡、弹窗 |

**阴影默认不投影** —— 卡片靠 1px 描边区分层次；hover 才用 `--opc-shadow-lift`，
浮层用 `--opc-shadow-overlay`。

胶囊（`999px`）只保留给**语义上确实是可选标签**的筛选 chip 与导航主 CTA。

---

## 5. 编辑式排版（去居中化）

这是本轮与复现态差别最大的部分。

### 5.1 复现态的问题

原站全站是「居中大标题 + 居中副标题 + 居中分隔线 + 居中筛选条」，
这是模板站最强的信号之一；滚动时节奏完全不变，页面没有「阅读起点」。

### 5.2 本轮的规则

| 位置 | 复现态 | 本轮 |
|---|---|---|
| 首页 hero | 居中标题 + 居中四指标 | **左对齐标题块**（品牌标记与标题横排）+ 底部**事实条**（细分隔线） |
| 内页 hero | 居中大标题 + 居中分隔线 | 左对齐标题 + 副标题，分隔线改为短横线 |
| `page-header` | 居中，padding 60–200px 四种规格 | 左对齐，统一 96px / 56px |
| 区块标题 | 居中 | 左对齐（eyebrow 为纯文字小标，非胶囊） |
| 卡片 | 灰底胶囊分类标签 | 纯文字 + 品牌色 |

### 5.3 eyebrow 规则

eyebrow 用**纯文字小标**：`text 12px / 500 / letter-spacing 0.12em / 品牌蓝`。
**不用**「圆角胶囊 + 描边」—— 后者同样是模板站的强信号。

---

## 6. 品牌替换

### 6.1 替换范围

| 原文案 | 替换为 | 处数 |
|---|---|---|
| 同橙OPC社区平台 | 集智AI OPC社区平台 | 33 |
| 同橙OPC社区 | 集智AI OPC社区 | 682 |
| 同橙OPC | 集智AI OPC | 1056 |
| 同橙 AI 学院 / 同橙AI学院 | 集智AI 学院 / 集智AI学院 | 142 |
| 同橙科创产业发展集团 | 集智AI 产业发展集团 | 78 |
| 同橙（其余） | 集智AI | 1604 |
| OPC Store / OPCStore | 集智AI | 113 |
| **合计** | | **3719** |

### 6.2 关键原则

**OPC 是业务概念词**（One Person Company / 一人公司），与品牌名无关，**不得替换**。
只替换运营方品牌「同橙」与站点名「OPC Store」。

### 6.3 实施位置

替换发生在**生成期**（`scripts/build-opc-content.py` 的 `rebrand()` / `rebrand_tree()`），
不是渲染期。这样 `pnpm opc:content` 重跑不会把品牌覆盖回原样。

属性值同样要替换 —— 原站把品牌写进了 `alt="同橙AI"`、`data-opc-category="同橙OPC社区"`，
只改文本节点会留下可见残留（`alt` 会被读屏软件读出来）。

### 6.3.1 ⚠️ 生成期替换管不到运行期拼出来的文案

**这是本轮实测发现的漏网路径。**
`scripts/build-opc-content.py` 只处理**生成产物 JSON**；
但有些文案是**运行期**在 TS 里拼出来的，根本不经过那套替换：

| 位置 | 原文案 | 现文案 |
|---|---|---|
| `src/lib/opc/content.ts` | `${article.title} - 同橙OPC社区平台` | `${article.title} - ${REPLICA_SITE_NAME}` |
| `src/lib/opc/llms.ts` | `# OPC Store · 同橙OPC社区` | `# ${REPLICA_SITE_NAME}` |

实测表现为：新闻详情页的 `<title>` 仍显示「… - 同橙OPC社区平台」，
而页面正文里的品牌已经全换掉了 —— **只查生成产物永远发现不了**。

修法与守护：

1. 站点名收敛到 `content.ts` 导出的常量 `REPLICA_SITE_NAME = '集智AI OPC社区平台'`，
   杜绝各处各写一份；
2. `test/opc-content.test.ts` 增加「runtime source files contain no reference-site brand residue」
   用例 —— 递归扫 `src/` 下所有 `.ts/.tsx/.json/.txt`，
   命中「同橙 / OPC Store / OPCStore / tongcc / tongcheng」即失败。

### 6.3.2 ⚠️ 品牌名之外，还有**原运营方的身份信息**

只换品牌名不够 —— 页脚「联系我们」里还留着同橙的**电话、邮箱、域名、地址与备案号**。
这些不是文案，是**公司身份**：

| 原站 | 本站（2026-10-22 业务方已提供） |
|---|---|
| `025-86551126` | `400-006-5858` |
| `hr@tongcheng.ai` / `opc@tongcheng.ai` | `developer@jimei.com.cn`；文章正文里的域名换成本站域名 |
| `https://www.tongcc.com` | `https://www.jizhiai.net.cn` |
| `https://t.3cool.cc`（原运营方的另一个站点域名） | `https://www.jizhiai.net.cn` |
| `https://ai.opcstore.com`（「算力超市」外链） | `https://th.jimei.cn` |
| `南京市鼓楼区古平岗4号智梦园B座` | `北京市丰台区西马场甲14号` |
| `苏ICP备2026012874号` | **未提供 → 不显示**（不顶替、不编造） |

处理原则（写在 `scripts/build-opc-content.py` 的 `replace_operator_contact()` 与
`inject_site_contact()` 里）：

1. **本站自己的联系位**（页脚 `.opcbottom`、关于页 `.contact-item`）：
   先把原运营方的电话 / 邮箱 / 备案号**整项删除**，
   再由 `inject_site_contact()` **写入本站的电话与邮箱**
   （沿用原站的语义结构：页脚用 `<li>` + Font Awesome 图标，
   关于页用 `.contact-item` = 图标 + 标题 + 值）；
   地址换成本站地址，域名换成本站域名。
2. **文章正文里的历史陈述**：地址只换「运营方总部地址」这一条，
   别的城市会场地址（如「常州市新北区新科创中心」）**保持原样** ——
   那是历史事实，不是身份声明。
3. **媒体 URL 不做品牌替换**：图片原始地址就在原站域名下
   （`asset-map.json` 的键是 `https://www.tongcc.com/uploads/...`），
   品牌规则若先改了 `src`，本地化就查不到映射，
   图片会变成指向本站不存在路径的远程链接。
4. **备案号**：业务方未提供 → 联系位**不渲染备案位**。
   主站 `src/lib/site/config.ts` 的 `site.contact` 里也**没有** ICP 字段，
   两边行为一致。

> 守护：`test/opc-content.test.ts` 的
> 「site contact surfaces carry this site identity and never the reference operator identity」
> 用例 —— 逐页检查联系位**必须**含本站电话 / 邮箱 / 地址 / 域名，
> 且**不含**原运营方身份信息与任何备案号字样。

### 6.4 Logo
页头文字 logo 换成 `public/logo-mark.svg`（浅底）与 `public/logo-mark-inverse.svg`（深底反白），
两张图都注入 DOM，用 CSS 按 `.opcheader:has(nav.is-home:not(.scrolled))` 切换 —— 不依赖 JS 判断当前页。

---

## 7. 对比度实测

`scripts/opc-contrast.mjs` 在 **32 页 × 2 断点（1440 / 390）× 4 滚动位置**
（`0 / 0.3 / 0.6 / 0.9`）上共采样 **2747 处文本**，按 WCAG 2.1 计算比值。

**最终结果：2747 处采样，0 处不达标**（另有 112 处 logotype 豁免，见 7.3）。

> **采样点为什么是 4 个**：采样是**视口内像素采样**，
> 元素不在视口里就采不到 —— 覆盖度直接取决于滚动位置的个数。
> 2026-10-22 实测：只采 `0` 与 `0.45` 时，`/work` 页的 `.stat-description`
> （原站 `#a3a3a3`，**2.39:1**）整段落在采样区之外，
> 报告写着「0 处不达标」却漏掉了真实问题。
> 加到 4 个等距位置后当场被抓出，修完再复测归零。

### 7.1 实测方法（为什么必须实测）

复刻页的背景**不是纯色**：首页 hero 是实时渲染的深蓝主视觉，内页有渐变、
网格纹理与半透明蒙版。静态取色、`rgba` 叠加推算、理论计算全部会漏判 ——
同一句话在不同滚动位置、不同断点下，结论可能相反。

实测流程：

1. **先滚动、再截图** —— `getClientRects()` 是视口坐标，截图也是视口截图；
   先截后滚会让两者坐标系错位，采样到错误区域。
2. 页面内把截图解成位图（**直接用 `data:` URL，不经过 blob** ——
   blob URL 可能让 canvas 被标记为 tainted，`getImageData()` 抛 SecurityError）。
3. 用 `Range.getClientRects()` 精确定位每个文字元素的像素范围。
4. 采样该范围内像素，**剔除接近前景色的像素**（那是字形本身），取众数当背景色。
5. 按字号与字重判定阈值（≥24px 或 ≥18.66px 粗体 → 3:1，其余 → 4.5:1）。

### 7.2 五处必须踩准的实现细节（实测踩出）

**细节一：滚动必须 `behavior:'instant'`，且必须复核落点。**
主站 `src/styles/globals.css` 里有 `scroll-behavior: smooth`，
普通 `window.scrollTo(0, y)` 会走平滑动画。长页面滚到中段时，
动画在等待窗口内**还没结束** —— 于是「截图那一刻」与「读 `getClientRects()` 那一刻」
落在**不同的滚动位置**，采样到的背景色完全是另一块区域。

实测中 `/newsdetail` 正文段落因此被判成 4.14:1（背景采到了图片边缘的灰蓝），
而该段落实际落在**不透明白底**上，真实对比度 8.2:1 —— 纯假阳性。

现在的做法：`instant` 滚动 → 等图片加载完（图片插入会改文档高度）
→ 按最终文档高度重新定位 → 截图 → 读 rect，
并**比对截图瞬间与采样瞬间的 `window.scrollY`**，不一致就作废本次数据。
脚本会打印「滚动落点漂移」告警并自动重定位。

**细节二：半透明文字必须先与背景合成再算亮度。**
直接拿 `rgba(255,255,255,0.88)` 的 RGB 当不透明色用，
等于把 88% 白当成 100% 白 —— 对比度被**系统性高估**。
正确做法是渲染真实像素：`comp = fg·a + bg·(1-a)`，再与 bg 比。

**细节三：渐变文字不能用 computed color 代表绘制色。**
`background-clip: text` 的元素把背景裁剪进字形，
此时 `getComputedStyle(el).color` 只是占位值，**真实绘制色是渐变本身**。
若按 computed color 去剔字形像素，就会把渐变像素当成背景色，
算出「白字压蓝底」的假阳性。

实测页头品牌字因此被判成 4.17:1（白字压 #1d83bd 渐变），
实际是**蓝色渐变字压白底**，完全达标。
按 WCAG 1.4.3，logotype 本身也免对比度要求 ——
脚本现在把它单列为 `exempt: 'logotype'`，不计入失败（全站 56 处，均为页头品牌字）。

**细节四：采样前必须把 CSS 动画推到终态。**
原站大量用入场动画（`reveal-*` / `hero-anim-*`），滚动进视口后才触发过渡。
过渡**未结束**时采样，拿到的是**中间态**的颜色。

实测：`.city-btn.active` 的底色正从白过渡到 `--opc-blue-deep` 时，
采样得到中间的浅蓝 `#75aad0` —— 白字压在上面只有 2.49:1，
而稳态是 `#0968ab`（**5.86:1**）。这是**假失败**，不是设计缺陷。

现在的做法：截图前遍历 `document.getAnimations()`，
对**有限动画**调 `finish()` 直接跳到终态（无限循环的装饰动画跳过，避免改变画面）。

**细节五：测量前必须屏蔽 dev-only 的开发浮层。**
Next.js 15 的**开发指示器**（`<nextjs-portal>`）是一个深色小徽章
（底色 `#2e2f31`），会**盖在页面内容上**。像素采样正好落在它上面时，
背景会被读成这个深色 → 报出根本不存在的对比度问题。

实测：`/nanjingzone` 移动端的「44 个 OPC 社区」被判成 **2.28:1**（蓝字 vs `#2e2f31`），
而用 `document.elementsFromPoint()` 一查，命中的是 `nextjs-portal`，
页面真实背景是浅色 `#f6f8fb`（蓝字在其上是 5.3:1，完全达标）。

现在的做法：测量前注入

```css
nextjs-portal, next-route-announcer { display: none !important; }
```

这个浮层**生产环境不存在**，所以屏蔽它不是「掩盖问题」，而是还原真实测量环境。

> 定位这类「数值可疑」的失败有个通用手法：
> `document.elementsFromPoint(x, y)` 打出该像素位置上**所有**叠加的元素栈，
> 一次就能看清是页面内容还是浮层压在上面。

**细节六：fixed 页头会遮住滚到顶部的文字，采样必须排除。**

这是**生产模式**才暴露出来的假失败（见 §12.5）。实测：首页 `/` 滚到 `scroll=0.6` 时，
`.adg-item-desc`「前沿AI技术驱动产业升级」「构建开放协同的创新生态」被判成
**1.85:1 / 3.43:1**，采样到的背景是 `rgb(179,180,181)`。

用 `document.elementsFromPoint()` 一查，命中栈是：

```
a → li → ul.nav-links → nav.is-home.scrolled
```

—— 命中的是 **fixed 页头导航**，不是文字本身。文字矩形中心在视口 `y=3`，
正好落在页头覆盖范围内。采到的是**导航的底色**，与该文字的真实对比度毫无关系。

现在的做法：收集采样目标时，对每个文字矩形取中心点做 `elementsFromPoint()`，
若栈顶既不是该文字元素、也不是它的后代或祖先，说明**有别的元素压在它上面** → 跳过该元素。

> ⚠️ 不能用「`rect.top < 页头高度`」这种写死阈值的判据：页头高度随滚动状态变化
> （首页首屏深色、滚后白色），而且遮挡源不止页头一个。用 `elementsFromPoint` 是通用判据。

**细节七：懒加载图片在「滚动落地之后」才开始加载，`IMAGES_READY` 覆盖不到。**

`IMAGES_READY` 在**滚动之前**执行。站点大量用 `loading="lazy"`，
视口外的图片在滚动到位之前**根本不会发起请求**，`img.complete` 恒为 `false` → 只能白等超时。

现在的做法：滚动落地之后**再等一次**「视口内图片解码完成」，
并且用 `img.decode()` 而不是只看 `complete` —— `complete` 只代表数据到齐，不代表已解码成可采样的像素。

```js
const inView = [...document.images].filter((i) => {
  const r = i.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > -60 && r.top < window.innerHeight + 60;
});
await Promise.all(inView.map(async (i) => {
  if (!i.complete) await new Promise((res) => {
    i.addEventListener('load', res, { once: true });
    i.addEventListener('error', res, { once: true });
  });
  try { await i.decode(); } catch {}
}));
```

> ⚠️ 模板字符串里写注释**不能用反引号**。`MEASURE` 与 `VISUAL_READY` 都是模板字符串，
> 注释里出现反引号会提前终止字符串、把注释变成真实 JS。本轮踩过一次：
> `node --check` 直接报 `SyntaxError: Unexpected identifier 'nav'`。
> 写完必须 `node --check scripts/opc-contrast.mjs` 过一遍。

### 7.3 修正历程

| 轮次 | 采样 | 不达标 | 说明 |
|---|---|---|---|
| 首轮 | 1350 | 134 | 灰字、品牌蓝小字、深底白字、深底容器被压成深灰 |
| 修正后 | 1356 | 28 | 容器级白字、`--opc-blue-deep` 收口 |
| 修正后 | 1353 | 20 | 通用基线规则压过定向覆盖（见 9.2 坑三） |
| 层叠修复后 | 1340 | 6 | 剩余 6 处：3 处是测量假阳性，3 处是真问题 |
| 采样点扩到 4 个 | 1352 | 3 | 抓出 `.stat-description`（原站 #a3a3a3，2.39:1）—— 此前 scroll=0.9 整段没采到 |
| 采样点扩到 4 个 | 2704 | 6 | 抓出 5 处「白字压品牌色」（4.38 / 4.29 / 2.75）+ 1 处 `.join-section` 误判深底 |
| **本轮** | **2746** | **0** | 修掉真问题 + 4 处测量方法修正 + logotype 豁免 |
| 站点信息改版后复跑 | 2798 | 0 | 换电话/邮箱/地址/域名 + 删备案号 + section 间距统一后复测，仍全绿 |

最后 6 处的真实构成：

| 元素 | 原状态 | 判定 | 处理 |
|---|---|---|---|
| 页头品牌字 | 4.17:1 | 假阳性（渐变文字） | 改为 logotype 豁免 |
| `/newsdetail` 正文段落 | 4.14:1 | 假阳性（滚动错位） | 滚动改 instant + 落点复核 |
| `/starproject` 引文 | 4.13:1 | 真问题 | `--opc-blue` → `--opc-blue-deep`（5.5:1） |
| `/zone` 社区名（蓝底卡片） | 4.17:1 | 真问题 | 渐变改用 `--opc-gradient`（最浅处 5.9:1） |
| 首页品牌字（同一元素另一断点） | 4.17:1 | 假阳性 | 同上 |

---

## 8. 主视觉

首页首屏原为 2026 OPC 创新发展大会的**实拍合影**，舞台背板上写着原站品牌大字招牌 ——
作为本站首屏是最刺眼的品牌冲突。

已替换为 `scripts/build-opc-hero.mjs` 生成的 4 张**科技蓝抽象主视觉**
（`public/opc/hero-{grid,flow,orbit,waves}.svg`，合计 9.6KB）：

| 构图 | 母题 |
|---|---|
| `grid` | 深蓝渐变 + 双层科技网格 + 六边形箭形（呼应 logo 徽记轮廓）+ 青绿弧 |
| `flow` | 流动曲线 + 节点，表达「链接 / 生态」 |
| `orbit` | 轨道系统 + 核心，表达「平台 / 汇聚」 |
| `waves` | 波浪层 + 方块矩阵，表达「数据 / 流动」 |

用 SVG 而非位图：1920×1080 全屏背景不压缩会糊，SVG 缩放无损且只有几 KB。

---

## 9. 实现约束（重要）

### 9.1 样式表的三层关系

```
public/opc/reference-blue.css   ← 机器生成的原站结构基线（pnpm opc:styles 会重跑覆盖）
src/styles/opc-tokens.css       ← 手写设计 token
src/styles/opc-components.css   ← 手写组件样式
src/styles/opc-interactions.css ← 手写交互态（弹窗、表单、菜单）
```

**手写层必须独立于生成层**，否则重跑 `pnpm opc:styles` 会把手改全部抹掉。

三层的**加载顺序**是硬约束，实测为：

```
layout.css（主站 globals.css） → reference-blue.css（原站基线） → page.css（设计层）
```

`reference-blue.css` 通过 `<link precedence="opc-reference">` 注入，
而手写层走 Next.js 的 CSS 打包链路，两者相对顺序**不由 import 位置决定**。

### 9.2 三层 CSS 的层叠坑（实测踩出）

**坑一：`!important` 优先于特异性。**
CSS Cascade 规定带 `!important` 的声明**先于**不带 `!important` 的生效，
且这一步发生在特异性比较**之前**。

原站参考 CSS 的规则不带 `!important`，因此会被设计层任意一条带 `!important` 的规则压过 ——
**哪怕设计层的选择器特异性低得多**。这是好事（改起来省事），但反过来：
设计层若漏写 `!important`，原站那条高特异性规则就会赢。

**坑二：同特异性时按加载顺序决胜，而加载顺序不由 import 语句控制。**
见 9.1。因此设计层要**排到 `reference-blue.css` 之后**：

> 设计层不能 import 在 `src/app/layout.tsx` —— 那会进 `layout.css`，
> 排在原站基线**之前**；也不能 import 在 Server Component `ReplicaPage.tsx` ——
> Next.js 只允许全局 CSS 在根布局 import，在 Server Component 里 import 会被**静默丢弃**
> （实测打包后整层设计样式完全没进产物，页面还是原站配色）。
>
> **正确位置是客户端组件 `ReplicaInteractions.tsx`** ——
> 客户端组件的 CSS 落在 `page.css`，而 `page.css` 排在最后。
> 顺带的好处：设计层不再进主站所有路由的 `layout.css`。

**坑三（本轮最隐蔽的一个）：通用基线规则的选择器不能比定向覆盖更具体。**

设计层有一条「正文字色统一收口」的兜底规则：

```css
.opc-replica.opc-replica p,
.opc-replica.opc-replica li,
.opc-replica.opc-replica dd,
.opc-replica.opc-replica span:not([class*='bg-']):not([class*='color-']) {
  color: var(--opc-ink-2) !important;
}
```

它的特异性是 **(0,4,1)** —— 两个 `.opc-replica` (0,2,0) + 两个 `:not()` 各带一个属性选择器 (0,2,0)
+ `span` 类型选择器 (0,0,1)。
而定向覆盖 `.opc-replica.opc-replica .about-content .adg-item-title` 只有 **(0,4,0)**。

**两条都带 `!important` 时高特异性者胜** —— 于是这条「兜底基线」反而压过了
它本该让路的每一条定向规则。表现是**「声明正确但计算值不符」**：
白字被压成 `ink-2`，实测影响 `.adg-item-title`（2.0:1）、`.adg-item-desc`、
`.sec-eyebrow--light`、`.city-btn.active span`（1.37:1）等一整批。

修法不是「把定向规则写得更长」（那是拿特异性打擂台，迟早再输一次），
而是**把基线规则降下来** —— 用 `:where()` 把作用域与 `:not()` 守卫的特异性**全部归零**：

```css
:where(.opc-replica.opc-replica) p,
:where(.opc-replica.opc-replica) span:not(:where([class*='bg-'], [class*='color-'])) {
  color: var(--opc-ink-2) !important;
}
```

基线规则降到 **(0,0,1)**，于是任何带类名的定向规则（≥ (0,1,0)）都压得过它，
而且**不再依赖加载顺序**。

> **通则：通用基线一律 `:where()` 包裹作用域，特异性压到 (0,0,1)；
> 定向覆盖才用双层 `.opc-replica.opc-replica X`（0,3,0）+。**
> 这样「基线 < 定向」是一条结构性保证，而不是每次手写时的人肉计算。

**本项目的约定**：

1. 设计层的**定向**选择器一律写成 `.opc-replica.opc-replica X`（特异性 0,3,0），
   根容器渲染为 `<div class="opc-replica opc-replica">`；
2. 设计层的**通用基线**一律用 `:where(.opc-replica.opc-replica)`（0,0,1）；
3. 要压过原站某条具体规则时，选择器要写得**和原站一样具体**
   （如 `.hero .hero-stats-row .hero-stat .hero-stat-num`），
   而不是笼统的 `.hero-stat-num`；
4. 变量定义块保持**单层** `.opc-replica`（变量靠继承传递，
   写成双层会要求根元素同时有两个类，过于脆弱）。

以上四条由 `test/opc-design-system.test.ts` 守护。

### 9.3 移动端菜单必须显式声明 `display:none`

桌面端 `.nav-links { display:flex }` 在组件层被提权后，会压过原站
`@media(max-width:900px)` 里的 `display:none`（同权重），
导致移动端菜单默认展开。必须在媒体查询里显式写 `display:none`。

### 9.4 ⚠️ 死规则：类名写错 = 整段样式静默失效

**这一条没有任何编译器或浏览器会报错** —— 规则合法，只是选不中任何元素。

实测踩过两处：

| 位置 | 写的类名 | 真实类名 | 后果 |
|---|---|---|---|
| 页脚整段 | `.footer` / `.opcfooter` | `.opcbottom` | 全站 15 个页脚的底色还是原站紫黑 `#1a1a2e`、链接还是 14px `#b0b0b0`、标题还是 20px —— 整段品牌化没生效 |
| 登录页「记住我 / 忘记密码」 | `.login-options` / `.form-options` | `.form-actions` | 该行未收口到字号阶 |

> 原站底部组件的结构是
> `<div class="opcbottom"><footer>` —— **`<footer>` 标签本身没有 class**，
> 只按标签名或按常见类名去写选择器都会落空。

**守卫**：`test/opc-design-system.test.ts` 的
「every class the design layer targets actually exists in the replica DOM」用例，
把设计层引用的每个类名与生成产物的真实类名对账；
只有运行期由 JS 注入 / React 渲染的类名可以豁免，且白名单里**必须写明来源**。

> 顺带产出一条通用规则：**凡是「写多个备选类名」的逗号列表，
> 都要单独确认每个备选是否真实存在** ——
> 冗余备选不会有害，但它们会让人误以为「这部分设计已经覆盖过了」。

### 9.5 ⚠️ 批量改写 CSS 时的两个陷阱（实测差点出事）

本轮为了清理死规则，写了个脚本用正则重写 CSS 源文件，踩了两个坑：

**坑一：扁平正则 `([^{}]+)\{([^{}]*)\}` 会把注释吃进选择器。**
规则的「选择器」部分实际是 `}` 与 `{` 之间的**所有内容**，
包括紧邻其上的注释。而注释里常出现文件名 —— `logo.svg`、`globals.css` ——
这些会被当成「指向不存在类名的选择器」，于是**整条规则连同注释一起被删**。
实测把整段「一、色彩系统」变量块（23 个 `--opc-*` 定义）删掉了。

> 正确做法：**先把注释切成独立片段**，只对代码片段做选择器处理。

**坑二：`@media` 嵌套块无法用扁平正则处理。**
`@media` 的 `{` 之后的内容整体是「声明」，
扁平正则会把内层规则和 `@media` 外壳拆散。

**兜底与教训**：

1. 这两个文件是**未跟踪的新文件**（`git checkout` 救不回来）；
   最终是从 **dev server 的编译产物** `.next/static/css/app/page.css`
   里恢复的 —— Next dev 会**完整保留 CSS 源码的注释与格式**，
   编译产物就是一份忠实的源文件快照。
   > **动之前先留一份编译产物快照**（或把新文件先 `git add` 纳入版本管理）。
2. 既有守卫其实**已经能抓到**这次事故 ——
   `test/opc-design-system.test.ts` 的 token 完整性用例会因 `--opc-blue` 缺失而失败。
   **教训：批量改写之后立刻跑测试，不要等到验收环节才跑。**

**坑三（本轮再次踩到）：手写编辑也会把注释块拆断。**
把一条单行闭合的注释（`斜杠 星号 … 星号 斜杠`）拆成多行说明时，
中间几行掉出了注释块，被浏览器当成**非法选择器**，
于是**整条规则被静默丢弃** —— 页面照常渲染，只是那条规则不再生效。

> CSS 解析器对非法选择器**不报错**，只忽略。
> 所以「文件里有这条声明」≠「这条声明生效」。
> 本轮已为此加了两条静态守卫（见 §10），
> 并把「**改完 CSS 立刻实测计算值**」写进流程。

### 9.6 ⚠️ 绝对定位伪元素：`left` + `right` + `width` 三者齐备 = 浏览器忽略 `right`

> 实测现象：1440 桌面下，首页与交易市场页的导航当前项（「首页」「交易市场」）
> 被响应式审计判为「文本硬裁」—— `scrollWidth(62) > clientWidth(50)`。
> 视觉上则是**下划线越过导航项右缘，压到相邻导航项**。

**根因链（三步，每一步都是实测出来的）**：

1. 原站 `public/opc/reference-blue.css` 里写着：
   ```css
   .nav-links a[data-v-…]:after { content:""; position:absolute; bottom:-10px; left:0; width:0; height:2px; … }
   .nav-links a.active[data-v-…]:after { width:100% }
   .nav-links a[data-v-…]:hover:after  { width:100% }
   ```
2. 设计层要把它改成「与文字等宽的下划线」，于是声明了
   `left:12px; right:12px; bottom:-1px; height:2px` ——
   **唯独没有声明 `width`**。
3. CSS 是**逐属性级联**的：设计层选择器特异性更高，
   只意味着 `left/right/bottom` 这三个属性取设计层的值；
   `width` 这个属性上设计层**压根没参与竞争** → 沿用原站的 `width:100%`。

于是绝对定位元素同时拿到 `left` + `right` + `width`，
属于 CSS 2.1 §10.3.7 的**过度约束**，规范规定此时**忽略 `right`**（LTR 下 `left` + `width` 胜出）：

- 包含块 = 链接的 padding box（50px，含左右各 12px padding）
- `width:100%` → 50px；`left:12px` → 右缘落在 **62px**
- 比链接自身右缘（50px）还宽 12px → 下划线压到相邻项；
  同时 `scrollWidth(62) > clientWidth(50)` → 被审计判成「文本硬裁」。

**修法**：设计层显式写 `width: auto !important`。
此时 `left`/`right` 正常拉伸，宽度 = 50 − 12 − 12 = **26px**，
恰好等于「首页」两个字的宽度。

**为什么值得单列一条**：这是「声明正确但计算值不符」的**第四种成因**。
前面三种（见 §9.2）都是**特异性算错**，这一种是**属性压根没写** ——
特异性再高也没用。单测能挡住前三种，挡不住这一种。

> 排查手法（可复用）：**逐个禁用样式表**，看计算值怎么变。
> 禁用 `reference-blue.css` 的瞬间 `scrollWidth` 从 62 掉到 50、
> `::after` 宽度从 50px 变成 26px —— 一句话就锁定了「原站 CSS 贡献了 width」。
> 比逐条读选择器快得多，也不会漏。

### 9.7 触控目标：WCAG 2.2 SC 2.5.8 的 24×24

响应式审计在 375 / 768 两档报出两类过小的可点目标：

| 元素 | 原高度 | 处置 |
|---|---|---|
| `.opcbottom .footer-item ul li a` | 18px（inline 行内盒） | 改 `inline-flex` + `min-height:24px` |
| `button.text-link`（「查看更多」） | 15px | 加 `min-height:24px` |

两处都**不动字号、行高与行距**：

- 页脚链接行高 23.4px，只比 24 少 0.6px → 每条链接只多撑高 0.6px，
  页脚整体几乎不膨胀（实测页脚高 368px）；
- `.text-link` 本就是 `inline-flex`，
  `min-height` 只是把 15px 的盒撑到 24px，文字垂直居中，视觉无变化。

> 附注：页脚链接的**行间距**本来就是 35px，
> 按 SC 2.5.8 的「24px 间距例外」其实也算达标。
> 之所以仍把盒本身撑到 24px，是因为审计脚本判的是**盒尺寸**；
> 让尺寸本身达标更稳，对读屏与触控笔也更友好。

**定位时的两个坑**（都真实踩过）：

1. 375 / 768 报出的「导航链接 18px」**根本不是导航** ——
   那是**页脚**链接（实测 `y` 值 9592 / 9627 / 9663 递增，纵向排列）。
   移动断点下 `.nav-links` 是 `display:none`，`getBoundingClientRect()` 全 0，
   审计器会正确跳过。**别看到「导航」二字就往导航上修。**
2. 1440 报出的「硬裁」是**桌面**导航 —— 它带 `.active` 类，
   而移动抽屉里的同名链接没有。两者靠类名区分，别混。

### 9.8 ⚠️ `max-width` 不能覆盖 `width`：原站的固定宽度阶梯

> 实测现象：768 平板首页出现 20px 横向滚动
> （文档 `scrollWidth` 788 > 视口 768），页面可左右拖动。

**根因链**：

1. 原站 `.container` 是**固定宽度阶梯**：`788 / 1012 / 1220 / 1940`，
   只靠 `@media(max-width:900px){.container{max-width:100%;padding:0 20px}}` 收口；
2. 设计层的容器规则写了 `max-width:1280px`（更高特异性 + 排在后面）→
   **把原站那条 `max-width:100%` 顶掉了**；
3. 但 **`max-width` 只是上限，不能覆盖显式 `width`** ——
   `width:788px` 与 `max-width:1280px` 并不冲突，于是 788px 存活：
   - 768 视口 → 容器宽 788px → 溢出 20px；
   - 901–1012px 视口 → 容器 1012px → 溢出更多（审计默认断点没覆盖到）。

**配套现象**：原站在小屏用 `margin-right:-20px` 做满幅，
而设计层写的是 `margin-inline:auto` —— 这是**逻辑属性**，
与物理属性 `margin-right` 的优先级仲裁实测未生效，负边距仍在 →
左右留白不对称（24 vs 44）。

**修法**：三条都显式写出来，别只写 `max-width`。

```css
.opc-replica.opc-replica .container {
  width: 100% !important;
  max-width: var(--opc-container) !important;
  margin-left: auto !important;
  margin-right: auto !important;
  padding-inline: var(--opc-gutter) !important;
}
```

实测结果：768 → 容器 768px（1280 上限不触发），左右各 24px 内边距；
1440 → 容器 1280px 居中；`scrollWidth == clientWidth`，零横向滚动。

**教训**：设计层「我只改了 `max-width`」≠「原站的 `width` 规则还在」——
被顶掉的是原站的**兜底**，而原站的**主规则**（固定宽度）反而活了下来。
> 凡是要「收口」某个尺寸属性，都要检查**同一属性上的所有声明**是否都被覆盖，
> 以及被顶掉的是不是**兜底那一条**。

### 9.9 ⚠️ 首页深底规则必须带 `:not(.scrolled)`

> 实测现象：首页滚到内容区后，页头已经变成白底，
> 但导航项与 logo **仍然是白色** —— 白字落在白底上，两者都不可读。

**根因**：运行期（`ReplicaInteractions.tsx`）把 `scrolled` 加在 **`<nav>`** 上
（与原站一致）。原站的白字规则写作：

```css
.opc-replica .opcheader .container nav.is-home:not(.scrolled) .nav-links a { color:#ffffffd9 }
```

即「首页**且未滚动**时才反白」。而设计层写的是：

```css
.opc-replica.opc-replica .opcheader:has(nav.is-home) .nav-links a { color: rgb(255 255 255 / 88%) !important; }
```

**没有 `:not(.scrolled)` 限定** → 滚动后白字规则依然生效。

配套问题：设计层另有一条 `.opcheader.scrolled` 的阴影规则，
而 JS 根本不把 `scrolled` 加在 `.opcheader` 上（加在 `nav` 上）——
**那条规则从未生效过**，只是没人注意到。

**修法**：13 处 `:has(nav.is-home)` 全部加 `:not(.scrolled)`；
阴影规则改成 `.opcheader:has(nav.scrolled)`。

实测（首页，1440px）：

| 状态 | `nav` 的 class | 页头底 | 导航字色 | logo 字色 | logo 图形 |
|---|---|---|---|---|---|
| `scrollY=0` | `is-home` | 透明 | `rgba(255,255,255,.88)` | `#fff` | 反白版 |
| `scrollY=4200` | `is-home scrolled` | `rgba(255,255,255,.92)` | `#4d5153` | `#1a2333` | 彩色版 |

**教训**：设计层与运行期 JS 必须就「**状态类挂在哪个元素上**」达成一致。
原站挂在 `nav`，设计层却按 `.opcheader.scrolled` 写 ——
**两套约定并存时两边都错**（JS 挂对了、样式没匹配上），
而且错得极安静：没有任何报错，只是「滚下去看不见字了」。

> 这类问题**对比度审计抓不到**：审计只采样 `scroll=0` 与 `scroll=0.45` 两个位置，
> 首页 hero 很长，`0.45` 仍落在 hero 内，页头还是透明深底。
> → 已在 `test/opc-design-system.test.ts` 加守卫：
> 任何 `.opcheader:has(nav.is-home)` 后面不带 `:not(.scrolled)` 即判失败。

### 9.10 ⚠️ `pnpm build` 会打断 dev server，实测前必须确认资产是新的

> 2026-10-22 实测：跑完 `pnpm build` 之后，dev server 的
> `layout.css` / `page.css` / 所有 JS chunk 全部 **404 或 MIME 错误**，
> 浏览器只剩缓存里的旧样式、**且 JS 完全没加载**。
> 表现是「交互全失效」（滚动态 `scrolled` 类永远不加），
> 极易被误判成「代码写错了」。

**排查信号**：浏览器控制台出现

```
Refused to apply style from '.../_next/static/css/app/page.css' because its MIME type ('text/html') is not a supported stylesheet MIME type
Failed to load resource: the server responded with a status of 404
```

**处置**：`mavis-trash -- .next` 后重启 dev（本项目用 `mavis-trash`，不用 `rm -rf`）。

> **流程建议**：先把所有需要 dev server 的审计跑完，**最后**再 `pnpm build`；
> build 完若还要实测，**必须先清 `.next` 并重启 dev**。
> 换句话说：`build` 与「基于 dev 的实测」不能交替进行，必须分段。

### 9.11 ⚠️ 「深底容器」名单里的类名，必须核对它在每个页面的真实背景

> 实测：`/community` 的「申请加入」是**白字落在白卡片上**（完全不可读），
> 而对比度审计只报出 2.75:1 —— 因为那一处**采到了别处的像素**，
> 真实情况比报告更糟。

**根因**：设计层有一条「深底容器」清单：

```css
.opc-replica.opc-replica :is(.about-content, .about-overlay, .join-section, .cta-card, …) {
  color: #fff !important;   /* 会继承给所有后代 */
}
```

而 `.join-section` 这个类名**只在 `/community` 出现**，
原站给它的是 `padding:60px 0 80px; margin-top:-100px` —— **没有背景**，是浅底区块。

于是白字被灌进浅底区块 → 白字白底。

**教训**：**类名在不同页面可能指向完全不同的东西。**
「加进深底名单」之前，必须确认这个类**在每个出现它的页面都是深底**。
本项目的做法：加之前先 `curl` 全部路由统计该类名的出现范围 ——
`.join-section` → `/community` 2 处、其余 18 个路由 0 处，
而 `/market` 的同类区块用的是**另一个类名** `.join-sec`（`section.section.join-sec`）。

> 注意区分：`.join-section`（社区页，浅底）与 `.join-sec`（市场/星计划页，深底 CTA 区）
> **是两个不同的类名**，只差一个 `-ion`。

### 9.12 ⚠️ 白字压品牌色，底色必须用「深」变体

> 实测（4 采样点全量审计，一次抓出 6 处）：
> 白字在 `--opc-blue #1d7fba` 上只有 **4.38:1**（要求 4.5:1），
> 在青绿 `#1fabbe` 上更只有 **2.75:1**。

**规则**（写进设计体系）：

| 场景 | 允许的色 | 理由 |
|---|---|---|
| 填充底 + 白字 | `--opc-blue-deep #0968ab` | 白字 5.86:1 |
| 边框 / 图标 / ≥24px 大字 | `--opc-blue #1d7fba` | 只作点缀，不承载小字 |
| 深底渐变容器 | 按**中段色**算，不是两端 | 原站 `135deg(#1d7fba,#0968ab)` 的中段是 `#1374b3`，88% 白字压在上面只有 **4.29:1** |

具体处置：

- `.join-cta`（市场页 / 星计划页的「立即加入 / 立即申请」胶囊按钮）
  底色 `#1d7fba` → `--opc-blue-deep`，hover → `--opc-navy`（白字 13.3:1）；
- `.cta-card`（首页收尾 CTA 卡）渐变 `#1d7fba→#0968ab` → `--opc-blue-deep→--opc-navy`；
- `.oc-join`（社区卡片「申请加入」）原站 `#1d7fba`（白底 4.16:1）→ `--opc-blue-deep`（5.87:1），
  同时避免被通用 `span → ink-2` 压成深灰而丢掉品牌色。

> 这条也是**采样覆盖度**的产物：把滚动采样从 2 个位置扩到 4 个之后才抓出来
> （此前只采 `0` 与 `0.45`，`scroll=0.9` 的页面底部区块整段没被采到）。
> 参见 §7 的说明。

### 9.13 ⚠️ SSR 静态 HTML 里的 `el-carousel` 永远不会切换

> 实测：首页有 4 张科技蓝主视觉（`hero-grid / flow / orbit / waves`），
> 但**永远只显示第一张** —— 指示器也没有、箭头也没有。

**根因**：原站的 `el-carousel` 是 **Vue 组件**。
SSR 静态 HTML 里每个 `.el-carousel__item` 的位移是**写死的内联值**：

```html
<div class="el-carousel__item is-active is-animating" style="transform:translateX(0px) scale(1)">
<div class="el-carousel__item" style="transform:translateX(1440px) scale(1)">
```

没有 Vue 运行时，这些 `transform` 就永远是死值。
而 Element Plus 的**指示器与箭头是运行时渲染的**，
所以静态产物里连 `.el-carousel__indicator` 都不存在。

**修法**（`src/components/opc/ReplicaInteractions.tsx`）：

- 原站 CSS 把 item 定位成 `position:absolute` 叠放（`width/height:100%`），
  所以**改用 opacity + z-index 做淡入淡出**，比改 transform 位移稳；
- 指示器由 JS 注入（`.opc-carousel-dots` / `.opc-carousel-dot`），
  自动播放 5.6s、悬停暂停、触摸滑动、点击指示器直跳；
- 尊重 `prefers-reduced-motion: reduce` —— 该偏好下**只手动切换，不自动播放**。

**配套的两个坑**：

1. **指示器的触摸目标**：视觉是 4px 细条，但 WCAG 2.2 SC 2.5.8 要求 24×24。
   所以按钮**盒高 24px**，细条用 `::after` 居中绘制
   （直接给按钮 4px 高会被响应式审计判为「触控目标过小」——本轮确实被判到过）。
2. `::after` 同时声明 `left` + `right` 时**必须显式写 `width: auto`**，
   否则又是一次过度约束（§9.6）。这条在本轮被新加的守卫**当场抓到**。

> 「全屏」这条原站已经满足：`section.hero { height:100vh; min-height:640px }`，
> 实测 1440×900 视口下 hero 高 **900px** = 视口高。

### 9.14 ⚠️ 区块留白不能「padding + margin」双重叠加

> 实测：首页各 section 的上下留白从 **0px 到 110px 不等**
> （`about-sec` 是 0，内容贴边；`features-sec` 是 100），
> 而设计层又给所有 `.section` 加了 `margin-bottom: 72px` ——
> 与原站自带的 `padding-bottom` 叠加，`features-sec` 的下留白达 **172px**。

**修法**：留白只由 padding 表达，margin 不再参与。

```css
.opc-replica.opc-replica .section {
  margin-bottom: 0 !important;
  padding-top: var(--opc-section-pad) !important;    /* 72px */
  padding-bottom: var(--opc-section-pad) !important;
}
```

实测修复后全站 8 个 section 统一为 `pt=72 / pb=72 / mb=0`，
相邻区块之间的实际留白从最坏 172px 收到 144px，且**处处一致**。

> 一般规律：留白只在一个维度上表达。
> `padding` 与 `margin` 同时给同一个方向时，用户看到的是两者之和，
> 而代码里很难看出这个和 —— **「异常空白」往往就是这么来的**。

---

## 10. 验收脚本

| 脚本 | 作用 |
|---|---|
| `scripts/opc-design-audit.mjs` | 设计基线审计：字号/字重/文字色/间距/圆角/阴影的档位分布，**并点名阶外元素**（页数 + 样例文本） |
| `scripts/opc-style-conflict.mjs` | 样式覆盖冲突检测：找出「声明了但计算值不符」的静默失效 |
| `scripts/opc-contrast.mjs` | 对比度实测：真实像素采样，多断点 × 多滚动位置；含滚动落点复核与 logotype 豁免 |
| `scripts/opc-inspect.mjs` | 单点诊断：给定路径 + 文本/选择器，打印祖先链、每层背景与最终计算值；`--shot` 可附像素色彩分布 |
| `scripts/opc-brand-audit.mjs` | 品牌文案上下文穷举与替换映射覆盖率 |
| `scripts/responsive-audit.mjs` | 响应式审计：横向溢出 / 字号过小 / 触控目标过小 |
| `scripts/build-opc-hero.mjs` | 生成科技蓝主视觉 |
| `scripts/build-opc-content.py` | 生成期内容编译 + 品牌替换 |

审计脚本均零依赖（CDP over Node 内置 WebSocket），可复跑复核。

> ⚠️ **审计脚本本身也会有假阳性，而且假阳性的根因往往是「测量的时机」或「遮挡」。**
> 本轮在生产模式一次性抓到两类（见 §7.2 细节六、细节七）：
> ① fixed 页头遮住滚到顶部的文字，采样落到导航底色上；
> ② 懒加载图片在滚动后才开始加载，采样早于解码。
> 两类都会**报出看起来很像真的**的数字（如 1.85:1），但真实值分别是 13.5:1 和 12.6:1。
> 排查顺序固定为：**先 `elementsFromPoint` 确认有没有东西压在上面 → 再确认资源/动画是否已到位 → 最后才判定为设计问题。**

> `scripts/opc-inspect.mjs` 是这一轮补的诊断工具：
> 对比度实测只会告诉你「某个元素对比度不达标」，
> 不会告诉你**它为什么是这个颜色、背后那层底是谁画的**。
> 排查「声明正确但计算值不符」这类问题时，靠它把祖先链和像素分布一次性摊开。

### 10.1 ⚠️ 量视口宽度要用 `clientWidth`，不是 `innerWidth`

> **一般规律：凡是量「视口」宽度，都要用 `documentElement.clientWidth`。**
> `window.innerWidth` 是**浏览器窗口宽度（含垂直滚动条与可能的 UI 边距）**，
> `clientWidth` 才是**内容区可用宽度**。

本轮实测踩过：响应式审计原本用 `window.innerWidth` 当「元素是否超出视口右缘」的阈值，
而它比 `clientWidth` 大 10–31px（取决于滚动条宽度），
**整体放宽了判定** —— 768 平板上容器宽 788px 这种真实溢出被判成 0，
直到改用 `clientWidth` 才暴露出来（见 §9.8）。

`overflow` 那一项一直是对的（`scrollWidth - clientWidth`），
但「哪个元素越界」这一项用错了基准，两项口径不一致就会漏报。

### 10.2 回归守卫（`test/opc-design-system.test.ts`）

除 token / 字号阶 / 死类名等既有契约外，本轮新增两条**文本层**守卫：

| 用例 | 守住什么 |
|---|---|
| 注释块结构完整 + 选择器不含中文 | 注释被拆断 → 整条规则被浏览器静默丢弃（§9.5 坑三）。判据：剥掉注释后，选择器位置出现 CJK / 全角符号即说明正文掉出了注释块 |
| 绝对定位伪元素不得只声明 `left`+`right` | 过度约束 → `right` 被忽略 → 伪元素右溢（§9.6）。判据：`position:absolute` 且同时给 `left`/`right` 的伪元素必须显式声明 `width` |
| 首页深底规则必须带 `:not(.scrolled)` | 首页滚动后白字落在白底上（§9.9）。判据：任何 `.opcheader:has(nav.is-home)` 后面不带 `:not(.scrolled)` 即失败 |

这两条守卫**当场生效过**：第一条在写完当天就抓到了我自己重复犯的
「把单行闭合注释拆成多行」的错误（`pnpm test` 报 259/260，定位到容器规则被丢弃）。

---

## 11. 已知未覆盖项

**新闻配图中的原站品牌物料**。新闻列表页 88 张 + 详情页 445 张配图是
历史活动实拍与横幅，画面里含原站品牌招牌。共 533 张。

这属于**内容资产**而非设计层问题，处理方式有三个选项：
保留原图 / 压暗处理 / 替换为集智AI 实际活动图。待业务方决定。

**本站 ICP 备案号**。业务方尚未提供 —— 页脚与关于页**一律不渲染备案位**，
原运营方的「苏ICP备2026012874号」已整项删除，不顶替、不编造。
提供后填入 `src/lib/site/config.ts` 的 `site.contact.icp` 即可恢复渲染。
（电话 `400-006-5858`、邮箱 `developer@jimei.com.cn`、
地址 `北京市丰台区西马场甲14号`、域名 `www.jizhiai.net.cn` 已于 2026-10-22 落地。）

**账号、短信验证码与申请后端**。本轮不接入；未配置时页面如实显示未配置状态，
不伪报成功。

---

## 12. 最终验收结论（2026-10-22）

### 12.1 全量实测数据

| 项目 | 命令 | 结果 |
|---|---|---|
| 单元测试 | `pnpm test` | **261 / 261 通过**（44 suites，0 fail） |
| 类型检查 | `pnpm typecheck` | 通过 |
| 项目自检 | `pnpm verify` | **6 项检查 · 6 OK / 0 FAIL** |
| 生产构建 | `pnpm build` | 成功（36 条路由全部产出） |
| 响应式审计 | `node scripts/responsive-audit.mjs` | **72 组合（18 页 × 4 档）· 0 问题** |
| 样式冲突审计 | `node scripts/opc-style-conflict.mjs` | **0 冲突** |
| 对比度审计 | `node scripts/opc-contrast.mjs` | **2798 处采样 · 0 不达标**（logotype 豁免 112） |
| 字号阶 | `node scripts/opc-design-audit.mjs` | 22 档，最小 12px |
| 品牌残留 | `node scripts/opc-brand-audit.mjs` | 同橙 / OPC Store / OPCStore / opcstore / tongcc 全 0 |

### 12.2 站点信息替换核对

生成产物与主站配置中，**旧身份信息全部为 0**：

```
苏ICP备2026012874        -> 0      025-86551126           -> 0
hr@tongcheng.ai           -> 0      南京市鼓楼区古平岗4号   -> 0
www.tongcc.com           -> 0      t.3cool.cc             -> 0
ai.opcstore.com           -> 0      同橙（运行期）          -> 0
```

新值全部就位：

```
400-006-5858              -> 29 处    developer@jimei.com.cn      -> 55 处
北京市丰台区西马场甲14号  -> 30 处    www.jizhiai.net.cn         -> 57 处
https://th.jimei.cn       -> 29 处
```

### 12.3 本轮功能项实测

| 需求 | 实测证据 |
|---|---|
| section 上下空白统一 | 首页 8 个 section 一致 `padding-top:72px / padding-bottom:72px / margin-bottom:0` |
| 备案号删除 | 页脚与关于页**不再渲染任何备案位**（业务方未提供 → 不顶替、不编造） |
| 电话 / 邮箱 / 地址 / 域名替换 | 29 / 55 / 30 / 57 处，见 §12.2 |
| `ai.opcstore.com` 替换 | 29 处 `https://th.jimei.cn`，旧域名 0 |
| 首页 banner 多图 | 4 张（`hero-grid / flow / orbit / waves`），指示器 4 个，`aria-selected` 同步 |
| 首页 banner 全屏 | 1440×900 视口下 carousel 高 **900px** = 视口高，横向溢出 0 |
| 自动轮播 | 5.6s 自动切换（实测 6.5s 后 `activeIdx` 0 → 1） |

### 12.4 生产模式（`pnpm build` + `pnpm start`）复验

dev 模式与生产模式的产物并非同一份 HTML —— 生产走 SSG/SSR 真实渲染，且**没有** dev-only 的
`<nextjs-portal>` 深色徽章污染像素采样。因此在生产模式复跑一遍三项审计更有说服力。

| 项目 | dev 结果 | 生产结果 |
|---|---|---|
| 首页 carousel 高 | 900px = 视口高 | **900px = 视口高** |
| 首页 slides / 指示器 | 4 / 4 | **4 / 4** |
| 运行时旧品牌信息 | 0 | **0**（`tongcheng`/`tongcc`/`025-86551126`/`古平岗`/`ai.opcstore` 全 false） |
| 运行时备案号 | 不渲染 | **不渲染** |
| `nextjs-portal` 数量 | 1（污染采样） | **0** |
| 横向溢出 | 0 | **0** |
| 响应式审计 | 72 组合 0 问题 | **72 组合 0 问题** |
| 样式冲突审计 | 0 | **0** |
| 对比度审计 | 2798 采样 / 0 不达标 | **2695 采样 / 0 不达标**（首轮 2 处失败 → 定位为测量假阳性并修复，见下） |
| 生产日志 error/warn | — | **0 条** |
| OPC 20 路由 | — | **全部 200** |

### 12.5 ⚠️ dev 全绿 ≠ 生产全绿

**生产模式首轮对比度审计抓到 dev 模式没抓到的 2 处失败**：
首页 `/` scroll=0.6 的 `.adg-item-desc`，被判成 **1.85:1 / 3.43:1**。

两处都是**测量假阳性**，但数字看起来非常像真问题，排查链路值得记录：

| 步骤 | 动作 | 结果 |
|---|---|---|
| 1 | 看采样到的背景色 | `rgb(179,180,181)` —— **中性灰**，但背景图是蓝调园区照（实测源图像素 `rgb(58,67,87)`～`rgb(84,92,113)`）→ 颜色对不上 |
| 2 | 算一下灰是从哪来的 | `rgb(247,249,252) × 0.72` —— 是**页面浅底**被压暗，不是背景图 |
| 3 | `document.elementsFromPoint()` 打元素栈 | 命中 `a → li → ul.nav-links → nav.is-home.scrolled` —— **fixed 页头导航**，不是文字本身 |
| 4 | 查文字实际位置 | 矩形中心在视口 `y=3`，**正好落在页头覆盖范围内** → 采样到的是导航底色 |

根因：**fixed 页头遮住了滚到视口顶部的文字**，像素采样落在遮挡物上。

同时发现第二个盲区：**懒加载图片**。`IMAGES_READY` 在滚动之前执行，
而 `loading="lazy"` 的图片在滚动到位前根本不会发起请求 → 采样早于解码，
会采到 webp 渐进解码的中间态。

两处修复后（详见 §7.2 细节六、细节七）：

- 采样前用 `elementsFromPoint` 排除被遮挡的文字；
- 滚动落地后用 `img.decode()` 等视口内图片解码完成。

复测结果：首页 8 组合全绿；全量 **2695 处采样 / 0 处不达标**。
真实对比度是 **12.6:1 ～ 17.2:1**（背景图被 `filter:brightness(.5)` 压暗后），
与最初报出的 1.85:1 差了 7～9 倍。

> **教训**：像素级审计必须区分「设计缺陷」与「测量缺陷」。
> 判定顺序固定为：**先 `elementsFromPoint` 确认有没有东西压在上面 →
> 再确认资源/动画是否已到位 → 最后才判定为设计问题。**
> 而且**必须跑生产模式** —— dev 的图片缓存与浮层状态会让假阳性/假阴性互相抵消。

### 12.6 已知限制

- **`pnpm build` 与「基于 dev 的实测」必须分段**（见 §9.10）：build 覆盖 `.next` 后 dev 静态资产会 404，
  必须 `mavis-trash -- .next` 并重启 dev。本次收尾已按此流程执行。
- **审计脚本依赖本机 Chrome**（`/Applications/Google Chrome.app`），CDP over Node 内置 WebSocket，零运行时依赖。
- **新闻配图 533 张的原生站品牌物料**属内容资产，非设计层问题，待业务方决定（见 §11）。

> **注**：`/zone?city=上海` 用 `curl` 直接请求会返回 **400** —— 这是 `curl` 未对中文 query 做 URL 编码所致，
> 不是站点缺陷；编码后（`%E4%B8%8A%E6%B5%B7`）返回 200。审计脚本走浏览器地址栏，无此问题。
>
> `/api/opc/content` 不带 `?id=` 时返回 404「内容不存在」是**设计行为**（路由校验 `^[1-9]\\d{0,8}$`），
> 带 `?id=392` 返回 200 与文章 JSON。
