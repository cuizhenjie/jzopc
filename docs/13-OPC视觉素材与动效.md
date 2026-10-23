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

## 首页 Banner 反馈处理（2026-10-23）

最新本地入口为 `http://127.0.0.1:3000/`，使用 `.next-opc-visual` 生产构建，BUILD_ID 为 `MNpeJVaU23Tpk0_X3EHXu`。当前源码保留后续18模板版本；南京专区和GPU资源页不恢复。

- 用户提供的 `exec-0894d06d-fff0-4353-9398-bf72cc5325d8.png` 是此前生成的算力 Banner，与仓库 `computing-banner.png` 原图的SHA256一致。首页顺序改为算力图、city-12、city-11、city-13；只有首帧高优先级加载。
- `/opc/assets/4d1f526a0478fe30.webp` 原为首页关于区的旧楼宇背景，生成器现在精确替换为 `reference-city-blue.webp`，来源是 `webimages/大图参考素材/u=2420042102,3108515115&fm=253&fmt=auto&app=138&f=JPEG.webp`。保留915×500自然尺寸和装饰语义，每次重生成均生效。
- 原因包含运行入口与源码版本不一致、关于背景槽位漏接，以及活动帧z-index越过蒙版。对比度诊断还证实：单独加深蒙版不生效；将carousel限制在z0后，控件需放到hero直接子节点以保持可见和可点击。关于区增加独立32%深蓝蒙版，手机使用全幅深蓝蒙版，标题/数据继续由真实文本呈现。
- 当前267项测试、typecheck、生产build、verify6项及媒体45/49校验通过。最终两文件只读复审已完成，无可操作P1/P2/P3；会话为 `01a1672d-1ac4-7e22-aa05-5c8a55b807db`。
- 最终3000生产页面通过375/768/1024/1200/1440五宽度逐帧验收：20次真实指示器点击、20帧与6次关于区采样全部通过；295行次文字对比度最差5.547:1，80组活动/非活动指示器最差3.407:1。9个Banner/关于背景URL的实际HTTP字节摘要匹配媒体清单，无旧图、断图、脚本异常或横向溢出。验收未注入修复CSS或搬移控件。
- 同一构建24项动效检查通过，覆盖键盘、焦点/悬停暂停、触摸、后台/离屏、减少动效、8个导航宽度、SPA清理和无JS正文。最终报告位于`/private/tmp/jizhi-banner-refresh/final-production/verification.json`及`/private/tmp/jizhi-banner-refresh/motion-final-production.log`。检查环境为本地Chrome、DPR 1，不能外推线上或真机结果；部分跨导航CDP响应体读取不可用已列在报告limitations，未计作HTTP成功的字节证明。

复跑当前入口动效检查：`node scripts/opc-motion-audit.mjs --base=http://127.0.0.1:3000`。本轮最新层级及对比度修复尚未另行提交或推送。

限额中断时的媒体管线、图标/Banner、接入、动效与审查测试已在后续补齐。本次继续关闭的是图片接入、入口同步和渲染可读性漏项。仍有58个受限资讯原图的降级：当前22篇详情中共69次占位图引用；18个模板与10城市变体无占位图。账号、短信、真实申请写服务、线上发布及真实手机验收仍未交付，不能用本地前台检查替代。

## 前次19页版本验收记录（历史）

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
