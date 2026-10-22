# 集智AI OPC：本地素材与动效增强

本轮从 `1ade4a0` 继续，保留现有品牌、路由和业务内容，采用用户提供的 `webimages` 图片。视觉方法来自已安装的 OpenDesign `web-prototype` 技能：先选版式节奏，再填入真实素材，最后独立检查层级、排版、色彩、图片和动效。未安装独立 OpenDesign App 或 MCP。本轮不依赖旧 `design.md`；中文无衬线字体与真实图片按用户要求保留。

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

首屏以淡入淡出轮播和少量过渡建立节奏，滚动内容以短距离揭示辅助阅读。SSR 和无 JavaScript 情况下正文直接可见。轮播在用户暂停、悬停、焦点进入、离屏、页面后台和减少动效时停止自动播放，并完整清理监听器和计时器。

## 本轮验收记录

待当前实现和独立审查完成后填写。此前测试和构建结果不作为本轮验收。
