# 集智AI OPC：本地素材与动效增强

本轮从 `1ade4a0` 继续，保留现有品牌、路由和业务内容，采用用户提供的 `webimages` 图片。视觉方法来自已安装的 OpenDesign `web-prototype` 技能：先选版式节奏，再填入真实素材，最后独立检查层级、排版、色彩、图片和动效。未安装独立 OpenDesign App 或 MCP。本轮不依赖旧设计规范；中文无衬线字体与真实图片按用户要求保留。

## 素材使用原则

- 首页采用科技城市与算力主题 Banner；仅首帧高优先级加载。原始大图不直接投放到 public。
- 活动照片用于独立的学习、交流和研学展示，不替换已有历史新闻封面，不虚构照片对应的时间、地点或活动关系。
- 用户提供的生态 Logo 保留原始比例和颜色，用 `contain` 展示；不新增合同合作、认证或背书声明。
- 智能体、市场、学院、星计划、社区、工作、算力、GPU 八个服务入口采用同一套64px SVG：2px笔画、统一蓝色和淡蓝底。品牌 Logo 不改成服务图标。
- 媒体来源、摘要、尺寸和派生尺寸由清单记录；生成器精确放行清单中存在的文件，不扩大到任意本地路径。

## 新生成的算力 Banner

工具：内置 `image_gen`，2026-10-22。

原始交付：`scripts/opc-source/visual-originals/computing-banner.png`；站内使用其压缩后的 WebP 派生图。

最终提示词：

> Create a premium technology website banner for a Chinese AI entrepreneurship community brand called JIZHI AI. Landscape panoramic composition approximately 2.4:1, dark midnight navy #142f59 and precise electric technology blue #1d7fba / #1aa8d3, restrained white highlights. A sophisticated photorealistic CGI arrangement of translucent glass computing cores and metallic server architecture, layered circuit-light pathways receding into a clean midnight horizon. Main detailed focal object on the RIGHT third, center-left 60 percent remains quiet dark blue negative space for website HTML headline and CTA. Low panoramic perspective, fine crisp details, sophisticated editorial art direction, minimal restrained bloom, no purple neon, no generic floating spheres, no humanoid robots. NO text, NO lettering, NO logos, NO watermark. The image must work as a modern enterprise AI computing service hero with readable white text overlay; full bleed edge-to-edge artwork, no frame.

## 动效约束

首屏以淡入淡出轮播和少量过渡建立节奏，滚动内容以短距离揭示辅助阅读。SSR 和无 JavaScript 情况下正文直接可见。轮播不提供播放/暂停按钮，在悬停、焦点进入、触摸、离屏、页面后台和减少动效时停止自动播放，并完整清理监听器和计时器。

## 本轮验收记录

2026-10-23，本地生产预览 `http://127.0.0.1:3133`，使用独立的 `.next-opc-build` 构建目录。

| 项目 | 当前证据 |
|---|---|
| 内容保留 | 当前19个模板、158篇正文、10个城市变体；南京专区移除后的其他动作与路由保留 |
| 素材 | 36张用户图片全部入库；连同生成Banner与8图标共45来源/49变体，2,137,054字节；部分参考图仅入库，不宣称已在页面展示 |
| 页面多尺寸 | 最新19页×375/768/1024/1200/1440宽度=95组合；全部200，0断图、0横向溢出、0运行时异常 |
| 业务交互 | 10项实际结果核验通过，包含搜索/分类、供需、海报弹窗、城市、分页、GPU参数、hash及表单说明；0写请求尝试 |
| 动效 | 最新仅指示器版本生产24项Chrome检查通过；触摸滑动/键盘/后台/离屏/减少动效、1200菜单、SPA清理与无JS正文均覆盖；此前含播放按钮版本25项为历史记录 |
| 像素对比度 | 首轮2552处采样发现37处失败；修复市场按钮、星计划读数面、GPU文字与按钮后，对4个受影响页双尺寸/4滚动点的759处采样复查，0失败 |
| 构建检查 | 当前生产build、typecheck、verify 6项及单元测试267项均通过；构建脚本硬化负例也已通过 |
| 性能观察 | 独立浏览器上下文375/1440首页采样CLS均0；本地未限速LCP116/92ms，仅表示本机预览观察，不代表线上或真实手机指标 |
| 独立审查 | 完整只读审查、五维目测及最终短复审均完成；最终对`188bc86`加当前工作区未发现新增可操作P1/P2/P3；审查session为`01a16445-c3cf-70c1-ac38-3b061361675c` |

复跑素材与内容：`npm run opc:visual`。核对源文件和派生摘要：`node scripts/build-opc-visual-media.mjs --check`。运行生产动效检查：`node scripts/opc-motion-audit.mjs --base=http://127.0.0.1:3133`。

本轮交付为本地前台实现与核验。账号、短信和提交入口继续明确说明其尚未接入实际写服务；未做线上发布或真实手机验收。
