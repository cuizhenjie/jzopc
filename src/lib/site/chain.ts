/**
 * 八大赋能的链路划分 —— 单一事实源。
 *
 * ## 为什么只有 6 个链路节点
 *
 * 八大赋能里，**空间 / 算力 / 智能体 / 订单 / 流量 / 资本** 构成一条有顺序的
 * 创业路径（从工位走到订单）；而**集智商学院**与**企服超市**是**贯穿全链的支撑能力**
 * —— 人才补齐与后台服务不占独立节点，它们作用于链上每一个环节。
 *
 * 这个划分同时解决了一个此前自相矛盾的问题：首页的链路组件写着
 * 「不是八个并列的功能，是一条从工位走到订单的路径」，
 * 而正下方却是**八张字面意义上并列的同款卡片**。现在：
 *   · 链路组件 = 6 个节点 + 「贯穿全链」支撑条（学院 / 企服）；
 *   · 卡片区   = 只展示 6 个链路模块，3 列网格；
 *   · 8 个赋能详情页全部保留可达（支撑条里的 chip 是链接）。
 *
 * 依据：`docs/05` §6.2「集智唯一能赢的叙事」、`docs/06` §2.4 卡片两档制。
 */

export type ChainModule = {
  slug: string;
  /** 链路节点标签（比模块名更强调"这一步"） */
  label: string;
};

/** 构成链路的 6 个模块，顺序即创业路径顺序 */
export const chainModules: ChainModule[] = [
  { slug: 'space', label: '空间起步' },
  { slug: 'compute', label: '算力' },
  { slug: 'agents', label: '智能体' },
  { slug: 'market', label: '订单' },
  { slug: 'traffic', label: '流量' },
  { slug: 'capital', label: '资本' },
];

/** 贯穿全链的支撑能力（不占独立节点） */
export const supportModuleSlugs = ['academy', 'enterprise'] as const;

/** 八个赋能模块的 slug 全集，用于自检 */
export const allEmpowerSlugs = [
  ...chainModules.map((c) => c.slug),
  ...supportModuleSlugs,
] as const;
