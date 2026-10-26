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

/** 历史内容就绪标记。公开菜单按 agent 全量契约展示，不再依此过滤。
 * 关于集智的四个子页已下线（2026-10-23），此表不再有条目。 */
export const contentReady: Record<string, boolean> = {};

/** 与 React 公共头部共用的规范导航；不再维护第二套链接。 */
export const nav = publicNavigation;

/** 已确认的三版简介，与关于页生成器共用一份数据。 */
export const intros = aboutCopy.intros;

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

/** 集智商学院文案已随原生 /academy 页下线（2026-10-26）删除——
 *  /center 复刻页的课程卡由 courses 表运行时化（blocks-runtime），不再需要静态 tracks/steps。 */

/** 智能体分类（后台资源模块的选项来源，与 agents 表 FK 对齐；/agent 运行时化的分区名同源） */
export const agentCategories = [
  { slug: 'office', name: '办公' },
  { slug: 'writing', name: '写作' },
  { slug: 'coding', name: '编程' },
  { slug: 'design', name: '设计' },
  { slug: 'image', name: '图像' },
  { slug: 'video', name: '视频' },
  { slug: 'audio', name: '音频' },
] as const;

/** 合作企业名单（16 家）已随公开页展示一起收敛进复刻快照与
 *  scripts 侧素材管线；后台 partners 表由运营维护，前台暂无消费方
 *  （2026-10-26 第二批清理时移除本数组，如需运行时化再恢复）。 */

/** 页脚 */
export const footerNav = [
  {
    title: '关于集智',
    links: [
      { label: '集智简介', href: '/about' },
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
    ],
  },
] as const;
