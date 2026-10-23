import {
  academy,
  advantages,
  agentCategories,
  contentReady,
  empowerModules,
  intros,
  marketSteps,
  nav,
  site,
  stats,
  visions,
} from '@/lib/site/config';

/**
 * 生成 `llms.txt`（llmstxt.org 规范）。
 *
 * ## 为什么要有这个文件
 *
 * llmstxt.org 提出：站点根目录放一份**面向 LLM 的 Markdown 摘要**，让 AI 助手
 * 不必抓取十几个页面就能理解「这个站是什么、有哪些入口、内容是否就绪」。
 * 搜索引擎不消费它，但越来越多的 AI 助手 / 检索工具会读。
 *
 * ## 为什么要从配置生成而不是手写
 *
 * 手写的 llms.txt 一定会在改导航、改文案后**悄悄过期**——而过期的摘要比没有更糟
 * （会把 AI 引向不存在的入口）。这里全部数据取自 `src/lib/site/config.ts`，
 * 也就是站点自己的唯一事实源，**改导航即同步**。
 *
 * 规范要点：
 *   - 一级标题 `#` = 站点名；紧跟 `>` 引用块 = 一句话摘要
 *   - `##` 分节；`- [标题](URL): 说明` 为条目
 *   - URL 用**绝对地址**（llmstxt.org 建议）
 */
export function buildLlmsTxt(): string {
  const base = site.url.replace(/\/+$/, '');
  const abs = (p: string) => (p.startsWith('http') ? p : `${base}${p.startsWith('/') ? '' : '/'}${p}`);
  const L: string[] = [];

  // ── 标题与摘要 ──
  L.push(`# ${site.name}`);
  L.push('');
  L.push(`> ${site.slogan}。${intros.v1}`);
  L.push('');
  L.push(
    `${site.company}旗下的一站式 AI 应用综合赋能平台，位于${site.address}，首期占地 ${site.area}，${site.launch}启动运营。` +
      `核心是**八大赋能**，它们构成一条从工位走到订单的链，而不是八个并列的功能。`,
  );
  L.push('');
  L.push('本文件按 llmstxt.org 规范由站点内容自动生成，用于让 AI 助手快速理解本站结构与入口。');
  L.push('');

  // ── 关键事实 ──
  L.push('## 关键事实');
  L.push('');
  for (const s of stats) L.push(`- ${s.label}：${s.value}${s.suffix}`);
  L.push(`- 地址：${site.address}`);
  L.push(`- 启动运营：${site.launch}`);
  L.push('');

  // ── 八大赋能（本站在线内容的主干）──
  L.push('## 八大赋能');
  L.push('');
  L.push('每项都有独立详情页；其中 6 项构成创业路径，2 项（集智商学院、企服超市）贯穿全链。');
  L.push('');
  for (const m of empowerModules) {
    L.push(`- [${m.title}](${abs(m.href)})：${m.tagline}`);
  }
  L.push('');

  // ── 主要入口 ──
  L.push('## 主要入口');
  L.push('');
  const seen = new Set<string>();
  for (const item of nav) {
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    const children = (item.children ?? []).filter((c) => contentReady[c.href] !== false);
    // llmstxt.org 规范要求 `- [标题](URL): 说明`，说明是必填的纯文本
    const desc = children.length
      ? `含 ${children.map((c) => c.label).join('、')} 等子页面`
      : '站点主页面';
    L.push(`- [${item.label}](${abs(item.href)})：${desc}`);
  }
  // 全局搜索不在主导航里（页头是搜索图标），但它是一个真实入口，必须写进摘要，
  // 否则 AI 助手不知道这个站可以一次性检索四类内容。
  L.push(`- [站内搜索](${abs('/search')})：一个搜索框覆盖智能体、供需、课程与动态，筛选条件写在地址栏可分享`);
  L.push('');

  // ── 智能体市场 ──
  L.push('## 智能体市场');
  L.push('');
  L.push(
    `覆盖${agentCategories.map((c) => c.name).join('、')}等场景，智能体条目均为**外链**到第三方产品。`,
  );
  L.push('');
  L.push('- [智能体列表](https://opcstore.com/webNew/index.html#/agent)：参考对标站点（本站智能体目录的对标原型）');
  L.push(`- [本站智能体目录](${abs('/agent')})：当前展示为**示例目录**，正式清单待按 opcstore 的分类采集后替换`);
  L.push('');

  // ── 供需市场 ──
  L.push('## 供需市场');
  L.push('');
  L.push('社区内撮合 + 外部企业需求；本期由社区运营人工对接，不做自动撮合。');
  L.push('');
  for (const s of marketSteps) L.push(`- ${s.index}. ${s.title}：${s.desc}`);
  L.push('');

  // ── 集智商学院 ──
  L.push('## 集智商学院');
  L.push('');
  L.push(`标签：${academy.tags.join('、')}。`);
  L.push('');
  for (const t of academy.tracks) L.push(`- [${t.name}](${abs('/center')})：${t.desc}`);
  L.push('');

  // ── 平台优势与愿景 ──
  L.push('## 平台优势与愿景');
  L.push('');
  L.push('优势：');
  for (const a of advantages) L.push(`- ${a}`);
  L.push('');
  L.push('愿景：');
  for (const v of visions) L.push(`- ${v}`);
  L.push('');

  // ── 关于集智 ──
  L.push('## 关于集智');
  L.push('');
  L.push(`- [集智简介](${abs('/about')})：${intros.v3[0]}`);
  const pending = (item: (typeof nav)[number]) =>
    (item.children ?? [])
      .filter((c) => contentReady[c.href] === false)
      .map((c) => c.label);
  const pendingAll = nav.flatMap(pending);
  if (pendingAll.length) {
    L.push(
      `- 内容筹备中（页面存在但正文待业务方补充，导航中暂不展示）：${pendingAll.join('、')}`,
    );
  }
  L.push('');

  // ── 留资 ──
  L.push('## 提交咨询 / 申请入驻');
  L.push('');
  L.push(
    `- [申请入驻](${abs('/apply')})：提交意向表，社区团队在一个工作日内联系。表单包含姓名、联系方式、项目方向等字段，并需勾选同意《入驻须知》。`,
  );
  L.push(`- 其它模块（算力超市 / 企服超市 / 流量赋能 / 资本政策）各自详情页内也提供留资表单。`);
  L.push('');

  // ── 使用说明（给 AI 助手看）──
  L.push('## 使用说明');
  L.push('');
  L.push(
    '- 本站为**营销与信息展示站点**，不提供登录注册，也没有站内对话式试用；智能体一律外链到第三方产品。',
  );
  L.push(
    '- 智能体与合作企业列表当前为**示例数据**，用于展示页面结构与排版，不应作为真实名录引用。',
  );
  L.push(
    '- 站内检索有两种方式：各列表页顶部的分类与关键词筛选（智能体 / 供需市场 / 社区动态），' +
      `以及覆盖全站四类内容的[站内搜索](${abs('/search')})页面（也可调用机器可读接口 \`GET /api/search?q=关键词\`）。`,
  );
  L.push('');

  return `${L.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}
