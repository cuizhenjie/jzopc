/** 站点常量与导航结构。文案以 docx 原文为准，见 docs/01-需求文档.md §6.2。 */

export const site = {
  name: '集智 AI OPC 社区',
  shortName: '集智 AI',
  latin: 'JIZHI · AI',
  slogan: '集众智之力，启 AI 未来',
  tagline: '一站式 AI 应用综合赋能平台',
  company: '北京集美科技有限公司',
  address: '北京市丰台区大红门',
  area: '3000+ ㎡',
  launch: '2026 年 10 月',
  // 生产根地址（用户确认）。本地开发可用 NEXT_PUBLIC_SITE_URL 覆盖。
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://t.3cool.cc',
  description:
    '集美科技旗下，面向 AI 创业团队的一站式 AI 应用综合赋能平台。位于北京丰台大红门，首期 3000 余平米，以八大赋能体系为核心，整合产业资源，赋能 AI 创业团队。',
  /**
   * 联系方式（PRD FR-HOME-09 要求页脚展示）。
   *
   * ⚠️ **空值是刻意的**：业务方尚未提供电话/邮箱，**不得臆造**。
   * 页脚按「有值才渲染」处理，所以留空不会显示空占位。
   * 填好后页脚会自动出现对应条目。
   */
  contact: {
    phone: '',
    email: '',
  },
} as const;

/** 品牌色（logo.svg 实测），供 canvas/shader 与内联样式使用 */
export const brand = {
  navy: '#142F59',
  navyDeep: '#0E3769',
  blue: '#1D7FBA',
  teal: '#57B6A5',
  cyan: '#1AA8D3',
  cyanLight: '#1FABBE',
  gradientFrom: '#0968AB',
  gradientTo: '#64C4D9',
  ink: '#4D5153',
} as const;

export const brandArray = [
  brand.navy,
  brand.blue,
  brand.teal,
  brand.cyan,
] as const;

export type NavChild = { label: string; href: string };
export type NavItem = {
  label: string;
  href: string;
  children?: NavChild[];
  /** 是否主按钮样式 */
  cta?: boolean;
};

/**
 * 导航项的内容就绪度（**数据表驱动，不是 Header 里硬编码**）。
 *
 * 规则见 PRD FR-ABOUT-05：「发展历程 / 服务对象」在**内容为空时从导航下拉中隐藏**，
 * 而不是展示一个空页。当前这两页只有 `Placeholder` 占位（内容缺口 G6 / G7），
 * 因此标记为未就绪；业务方补齐内容后把这里改成 `true` 即可，导航会自动出现。
 *
 * 未来接 Supabase `site_contents` 表时，把这张表换成按 section 查询即可，
 * Header 侧的过滤逻辑无需改动。
 */
export const contentReady: Record<string, boolean> = {
  '/about/history': false,
  '/about/audience': false,
};

export const nav: NavItem[] = [
  {
    label: '关于集智',
    href: '/about',
    children: [
      { label: '集智简介', href: '/about' },
      { label: '发展历程', href: '/about/history' },
      { label: '服务对象', href: '/about/audience' },
      { label: '生态伙伴', href: '/about/partners' },
    ],
  },
  {
    label: '八大赋能',
    href: '/empower/space',
    children: [
      { label: '集智空间', href: '/empower/space' },
      { label: '智能体', href: '/empower/agents' },
      { label: '算力超市', href: '/empower/compute' },
      { label: '集智学院', href: '/empower/academy' },
      { label: '企服超市', href: '/empower/enterprise' },
      { label: '供需市场', href: '/empower/market' },
      { label: '流量赋能', href: '/empower/traffic' },
      { label: '资本政策', href: '/empower/capital' },
    ],
  },
  { label: '智能体', href: '/agents' },
  { label: '供需市场', href: '/market' },
  { label: '流量超市', href: '/traffic' },
  { label: '集智商学院', href: '/academy' },
  { label: '社区动态', href: '/news' },
  { label: '申请入驻', href: '/apply', cta: true },
];

/** 三大版简介（docx 原文） */
export const intros = {
  v1: '集美科技旗下，面向 AI 创业团队的一站式 AI 应用综合赋能平台。',
  v2: '集智 AI OPC 社区 · 北京集美科技有限公司 · 2026 年 10 月启动运营。集美科技旗下的一站式 AI 应用综合赋能平台，位于北京丰台大红门，首期占地超 3000 平米。平台以集智空间、智能体、算力超市、集智商学院、企服超市、订单市场、流量赋能、资本政策八大赋能体系为核心，整合产业资源，赋能 AI 创业团队，构建 AI 产业生态。',
  v3: [
    '集智 AI OPC 社区由北京集美科技有限公司打造，位于北京丰台大红门，首期占地超 3000 平方米，是面向 AI 创业团队与「一人公司」的一站式赋能平台，2026 年 10 月正式启动运营。',
    '社区把 AI 创业需要的八件事铺成一条链：3000 ㎡ 实体空间提供工位、独立办公室、会议室、路演厅与直播影棚，拎包入驻；算力超市让 GPU 按需取用、对接算力券；智能体把大模型封装成可直接上岗的数字员工；集智商学院用实战课程与 AIGC 认证把人补齐；企服超市承接人事、财税、法务与知产，丰台区人力资源服务中心与青创会已驻场空间，办事窗口就在楼里；订单市场把社区能力与外部 1000+ 家企业需求放在同一张桌子上；流量赋能依托已入驻社区的 AIGC 流量生产基地，让产品先被看见；资本政策对接创投机构、协助申报 AI OPC 相关政策。',
    '我们相信，AI 时代一个人也能是一家公司。社区要做的，是把这家公司缺的每一环提前铺好——让创业者只管把产品做好。',
  ],
} as const;

/** 首页指标 */
export const stats = [
  { key: 'agents', value: 500, suffix: '+', label: '入驻智能体' },
  { key: 'creators', value: 1000, suffix: '+', label: '活跃创业者' },
  { key: 'courses', value: 100, suffix: '+', label: '精品课程' },
  { key: 'partners', value: 50, suffix: '+', label: '生态伙伴企业' },
] as const;

/** 八大赋能：编号 / 标题 / 一句话（docx 原文表） */
export const empowerModules = [
  {
    slug: 'space',
    index: '01',
    title: '集智空间',
    tagline: '拎包入驻的工位与独立办公室，会议、路演、直播一站配齐。',
    href: '/empower/space',
    leadType: 'space',
  },
  {
    slug: 'agents',
    index: '02',
    title: '智能体',
    tagline: '把大模型封装成能直接干活的数字员工，不开技术门槛。',
    href: '/empower/agents',
    leadType: null,
  },
  {
    slug: 'compute',
    index: '03',
    title: '算力超市',
    tagline: 'GPU 按需租用，大模型一次接入，还能对接算力券补贴。',
    href: '/empower/compute',
    leadType: 'compute',
  },
  {
    slug: 'academy',
    index: '04',
    title: '集智商学院',
    tagline: '实战课程、AIGC 认证、研学班与就业推荐，一条线把人补齐。',
    href: '/empower/academy',
    leadType: null,
  },
  {
    slug: 'enterprise',
    index: '05',
    title: '企服超市',
    tagline: '人、财、税、法四项基础服务打包，后台的事交给专业的人。',
    href: '/empower/enterprise',
    leadType: 'enterprise',
  },
  {
    slug: 'market',
    index: '06',
    title: '订单市场',
    tagline: '社区内撮合，外部接 1000+ 家企业需求，把能力直接变成收入。',
    href: '/empower/market',
    leadType: null,
  },
  {
    slug: 'traffic',
    index: '07',
    title: '流量赋能',
    tagline: 'AIGC 内容产能就在社区里，让产品先被看见，再谈成交。',
    href: '/empower/traffic',
    leadType: 'traffic',
  },
  {
    slug: 'capital',
    index: '08',
    title: '资本政策',
    tagline: '对接创投机构，协助申报 AI OPC 相关政策，把钱的问题也解决。',
    href: '/empower/capital',
    leadType: 'capital',
  },
] as const;

/** 平台优势 4 条（docx 原文） */
export const advantages = [
  '八大赋能一体贯通，需求不出社区',
  '订单与流量双入口，做完就能卖',
  '人才、财税、法务在场，后台不出楼',
  '集团四十余年产业背书，起点不是零',
] as const;

/** 愿景 4 条（docx 原文） */
export const visions = [
  '让每一个 AI 项目在此落地生长',
  '让团队先拿到订单，再谈规模',
  '把社区跑成可复制的样板',
  '让丰台成为 AI 应用落地的一线阵地',
] as const;

/** 供需市场 4 步（docx 原文） */
export const marketSteps = [
  { index: '1', title: '供需发布', desc: '发布 AI 项目需求或智能体服务，高效撮合产业合作机会' },
  { index: '2', title: '智能匹配', desc: '依托社区生态，精准对接开发者、投资方与产业资源' },
  { index: '3', title: '能力展示', desc: '上架AI产品与落地案例，打造个人与项目品牌影响力' },
  { index: '4', title: '产业共创', desc: '融入集智 AI 开放社区，携手伙伴共建 AI 智能体产业生态' },
] as const;

/** 集智商学院 */
export const academy = {
  title: '集智商学院',
  slogan: '学AI技能拿高薪Offer让未来，从这里开始',
  summary: '提供AI人才培养与就业服务，助力个人成长与企业数字化升级',
  tags: ['实战教学', 'AIGC认证', '研学班', '项目驱动', '名企合作'],
  tracks: [
    { name: 'AI电商', desc: '选品、内容与店铺智能运营', tag: '增长实战' },
    { name: 'AIGC', desc: '文案、图像与视频内容生产', tag: '热门方向' },
    { name: 'AI漫剧', desc: '剧本、分镜与AI漫剧制作', tag: '项目实训' },
    { name: '大数据工程师', desc: 'Hadoop、Spark、Flink 技术栈', tag: '技术岗位' },
    { name: '短视频运营', desc: '策划、制作与账号增长运营', tag: '就业实用' },
  ],
  steps: [
    { step: '01', title: '职业测评', points: ['能力测评', '兴趣测评', '价值观评估'] },
    { step: '02', title: '技能培训', points: ['线下授课', '专项技能学', '企业真实项目'] },
    { step: '03', title: '项目实战', points: ['企业级项目', '团队协作训练', '项目成果展示'] },
    { step: '04', title: '求职面试', points: ['简历优化', '模拟面试', '企业岗位匹配'] },
    { step: '05', title: '就业推荐', points: ['企业岗位推荐', '定制化岗位推荐', '就业跟踪服务'] },
    { step: '06', title: '入职跟踪', points: ['试用期跟踪', '职位适应辅导', '长期成长支持'] },
  ],
} as const;

/** 智能体副标与分类 */
export const agentCategories = [
  { slug: 'office', name: '办公' },
  { slug: 'writing', name: '写作' },
  { slug: 'coding', name: '编程' },
  { slug: 'design', name: '设计' },
  { slug: 'image', name: '图像' },
  { slug: 'video', name: '视频' },
  { slug: 'audio', name: '音频' },
] as const;

export const agentHero = {
  title: '集智·探索 AI 的无限可能',
  subtitle:
    '汇聚全球顶尖 AI 智能体，覆盖办公、写作、编程、设计、图像、视频、音频等全方位场景',
} as const;

/** 合作企业（参考图素材，真伪待业务方确认） */
export const partners = [
  '华为', '阿里巴巴', '腾讯', '字节跳动', '百度', '美团', '京东', '滴滴',
  '小米', '网易', '哔哩哔哩', '快手', '知乎', '微博', '豆包', '携程',
] as const;

/** 页脚 */
export const footerNav = [
  {
    title: '关于集智',
    links: [
      { label: '集智简介', href: '/about' },
      { label: '发展历程', href: '/about/history' },
      { label: '服务对象', href: '/about/audience' },
      { label: '生态伙伴', href: '/about/partners' },
    ],
  },
  {
    title: '八大赋能',
    links: empowerModules.map((m) => ({ label: m.title, href: m.href })),
  },
  {
    title: '社区',
    links: [
      { label: '智能体', href: '/agents' },
      { label: '供需市场', href: '/market' },
      { label: '集智商学院', href: '/academy' },
      { label: '社区动态', href: '/news' },
      // 全局搜索（FR-SITE-08）：一个入口覆盖上面四类内容
      { label: '站内搜索', href: '/search' },
    ],
  },
] as const;
