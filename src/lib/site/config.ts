/** 站点常量。文案以已确认内容为准，公开导航从轻量模块共享。 */
import aboutCopy from './about-copy.json' with { type: 'json' };
import { publicNavigation } from '@/lib/site/navigation';
export type { NavChild, NavItem } from '@/lib/site/navigation';

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
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.jizhiai.net.cn',
  description:
    '集美科技旗下，面向 AI 创业团队的一站式 AI 应用综合赋能平台。位于北京丰台大红门，首期 3000 余平米，以八大赋能体系为核心，整合产业资源，赋能 AI 创业团队。',
  /**
   * 联系方式（PRD FR-HOME-09 要求页脚展示）。
   *
   * 2026-10-22 业务方已提供电话与邮箱，此处如实填写。
   * ⚠️ **ICP 备案号业务方未提供** —— 页脚与关于页一律不渲染备案位，
   * 不用任何来源的备案号顶替。
   */
  contact: {
    phone: '400-006-5858',
    email: 'developer@jimei.com.cn',
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

/** 历史内容就绪标记。公开菜单按 agent 全量契约展示，不再依此过滤。 */
export const contentReady: Record<string, boolean> = {
  '/about/history': false,
  '/about/audience': false,
};

/** 与 React 公共头部共用的规范导航；不再维护第二套链接。 */
export const nav = publicNavigation;

/** 已确认的三版简介，与关于页生成器共用一份数据。 */
export const intros = aboutCopy.intros;

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
    title: '供需市场',
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

/** 与关于页共用的优势与愿景；保留普通业务语义中的「订单」。 */
export const advantages = aboutCopy.advantages;
export const visions = aboutCopy.visions;

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
  '小米', '网易', '哔哩哔哩', '快手', '知乎', '微博', '豆瓣', '携程',
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
      { label: '智能体', href: '/agent' },
      { label: '供需市场', href: '/market' },
      { label: '集智商学院', href: '/center' },
      { label: '社区动态', href: '/newslist' },
      // 全局搜索（FR-SITE-08）：一个入口覆盖上面四类内容
      { label: '站内搜索', href: '/search' },
    ],
  },
] as const;
