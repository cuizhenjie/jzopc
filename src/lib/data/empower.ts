export type EmpowerDetail = {
  slug: string;
  index: string;
  title: string;
  tagline: string;
  /** 页面主视觉的一句话副标题 */
  heroDesc: string;
  /** 核心价值点 */
  values: { title: string; desc: string }[];
  /** 清单区条目 */
  items: string[];
  /** 数据指标（可选） */
  highlights?: { label: string; value: string; note?: string }[];
  /** 内容缺口说明（若有） */
  pending?: string;
  /** 相关推荐 slug */
  related: string[];
};

export const empowerDetails: EmpowerDetail[] = [
  {
    slug: 'space',
    index: '01',
    title: '集智空间',
    tagline: '拎包入驻的工位与独立办公室，会议、路演、直播一站配齐。',
    heroDesc:
      '首期 3000 余平米，位于北京丰台大红门。工位、独立办公室、会议室、路演厅与直播影棚一站配齐，工商财税法务办事窗口就在楼里。',
    values: [
      { title: '拎包入驻', desc: '工位与独立办公室即刻可用，不需要等待装修与采购周期，先把产品做出来。' },
      { title: '会议与路演', desc: '共享会议室与路演厅按需预约，客户来了有地方见，投资人来了有地方讲。' },
      { title: '直播影棚', desc: '带绿幕的直播影棚在楼内，AIGC 内容产能与真人出镜可以同日完成。' },
      { title: '办事窗口在楼里', desc: '丰台区人力资源服务中心与青创会已驻场，工商、财税、法务不用再跑几个地方。' },
    ],
    items: [
      '开放工位与独立办公室',
      '共享会议室与洽谈区',
      '路演厅与直播影棚',
      '工商注册 / 财税 / 法务一站式',
      '园区班车与生活配套',
    ],
    highlights: [
      { label: '首期面积', value: '3000+ ㎡' },
      { label: '位置', value: '丰台 · 大红门' },
      { label: '启动运营', value: '2026 年 10 月' },
    ],
    related: ['academy', 'enterprise', 'market'],
  },
  {
    slug: 'agents',
    index: '02',
    title: '智能体',
    tagline: '把大模型封装成能直接干活的数字员工，不开技术门槛。',
    heroDesc:
      '汇聚覆盖办公、写作、编程、设计、图像、视频、音频等场景的 AI 智能体，帮你把重复的活儿交出去。',
    values: [
      { title: '不开技术门槛', desc: '按场景挑就行，不用理解模型、不用配环境，选中就能用。' },
      { title: '场景全覆盖', desc: '从写文档到出视频，从写代码到做设计，一个人常用的工具基本都在这里。' },
      { title: '持续更新', desc: '智能体目录持续扩充，新增条目会同步到社区市场与本页面。' },
    ],
    items: ['办公协同', '写作与长文', '编程与代码', '设计出图', '图像生成', '视频生成', '音频与配音'],
    related: ['academy', 'market', 'traffic'],
  },
  {
    slug: 'compute',
    index: '03',
    title: '算力超市',
    tagline: 'GPU 按需租用，大模型一次接入，还能对接算力券补贴。',
    heroDesc:
      '把分散的算力供应商接到一个入口上。社区团队按你的项目阶段与月度预算给建议，不鼓励一上来就囤算力。',
    values: [
      { title: '按需取用', desc: '训练与推理的常见规格都接进来了，用多少付多少，不必提前签年框。' },
      { title: '一次接入', desc: '大模型 API 统一入口，不用逐个去和各家云厂商谈合同与适配。' },
      { title: '算力券对接', desc: '社区协助对接算力券与相关补贴，按项目情况分档申报。' },
    ],
    items: ['GPU 按需租用', '大模型 API 统一接入', '算力券与补贴对接', '优先渲染通道申请', '成本优化建议'],
    pending: '具体 GPU 型号、单价与到账周期以社区团队给出的方案为准，正在整理中。',
    related: ['agents', 'capital', 'market'],
  },
  {
    slug: 'academy',
    index: '04',
    title: '集智商学院',
    tagline: '实战课程、AIGC 认证、研学班与就业推荐，一条线把人补齐。',
    heroDesc:
      '学AI技能拿高薪Offer让未来，从这里开始。提供AI人才培养与就业服务，助力个人成长与企业数字化升级。',
    values: [
      { title: '实战教学', desc: '线下授课 + 真实项目，不用拿练习题糊弄人。' },
      { title: 'AIGC 认证', desc: '面向已有实操经验、希望对外证明能力的学员。' },
      { title: '研学班', desc: '面向刚起步、需要完成一个完整项目的学员。' },
      { title: '就业推荐', desc: '课程结束后进入岗位推荐与入职跟踪环节。' },
    ],
    items: ['AI 电商', 'AIGC', 'AI 漫剧', '大数据工程师', '短视频运营'],
    related: ['space', 'agents', 'enterprise'],
  },
  {
    slug: 'enterprise',
    index: '05',
    title: '企服超市',
    tagline: '人、财、税、法四项基础服务打包，后台的事交给专业的人。',
    heroDesc:
      '工商财税法务是每个团队都要重复做的事。把它们打包给专业的人，你只保留真正该你做的事。',
    values: [
      { title: '人', desc: '社保、公积金、招聘与劳动关系的基础事务。' },
      { title: '财', desc: '记账、报税、账务梳理与成本结构建议。' },
      { title: '税', desc: '税务合规与专项事项处理。' },
      { title: '法', desc: '合同审阅、知识产权与常见商事法律问题。' },
    ],
    items: ['工商注册与变更', '代理记账与报税', '合同与法务顾问', '知识产权与商标', '人事社保代办'],
    pending: '具体服务清单、承办方与计费方式正在与服务商确认，整理完成后在此公示。',
    related: ['space', 'capital', 'market'],
  },
  {
    slug: 'market',
    index: '06',
    title: '供需市场',
    tagline: '社区内撮合，外部接 1000+ 家企业需求，把能力直接变成收入。',
    heroDesc:
      '加入集智 AI OPC 交易市场 上架智能体能力，发布项目需求，链接产业伙伴，共筑 AI 产业新生态。',
    values: [
      { title: '供需发布', desc: '发布 AI 项目需求或智能体服务，高效撮合产业合作机会。' },
      { title: '智能匹配', desc: '依托社区生态，精准对接开发者、投资方与产业资源。' },
      { title: '能力展示', desc: '上架AI产品与落地案例，打造个人与项目品牌影响力。' },
      { title: '产业共创', desc: '融入集智 AI 开放社区，携手伙伴共建 AI 智能体产业生态。' },
    ],
    items: ['需求发布与承接', '能力与案例展示', '社区内优先撮合', '外部企业需求对接'],
    related: ['agents', 'traffic', 'capital'],
  },
  {
    slug: 'traffic',
    index: '07',
    title: '流量赋能',
    tagline: 'AIGC 内容产能就在社区里，让产品先被看见，再谈成交。',
    heroDesc:
      '依托已入驻社区的 AIGC 流量生产基地，把内容产能放在创业者触手可及的地方——先被看见，才谈得上成交。',
    values: [
      { title: '产能在场', desc: 'AIGC 内容生产团队就在社区里，需求可以直接对接人，不用走采购流程。' },
      { title: '先被看见', desc: '产品上线前的素材、投放与内容测试，社区能提供就近的支持。' },
      { title: '从流量到成交', desc: '流量不是终点，最终还是要回到订单与收入。' },
    ],
    items: ['AIGC 内容生产', '产品素材与视觉', '投放与账号运营', '内容测试与迭代'],
    pending:
      '集智AIGC新媒体流量基地介绍与赋能机制的资料正在整理中，正式内容将补充到本页。',
    related: ['market', 'agents', 'academy'],
  },
  {
    slug: 'capital',
    index: '08',
    title: '资本政策',
    tagline: '对接创投机构，协助申报 AI OPC 相关政策，把钱的问题也解决。',
    heroDesc:
      '创业早期最缺的两样东西：启动资金和政策支持。社区把对接与申报协助放在同一张桌子上。',
    values: [
      { title: '创投对接', desc: '对接关注 AI 与一人公司的投资机构，以真实交付能力而不是 PPT 做判断。' },
      { title: '政策申报协助', desc: '协助理解并申报 AI OPC 相关政策，减少创业者自己摸政策的时间。' },
      { title: '把时间还给产品', desc: '跑腿的事交给社区，创业者把时间花在打磨产品和接客户上。' },
    ],
    items: ['创投机构对接', 'AI OPC 政策申报协助', '算力券与数据券通道', '融资材料预审建议'],
    pending: '具体政策清单、申报流程与对接机构名单正在整理中。',
    related: ['compute', 'enterprise', 'market'],
  },
];

export function getEmpowerDetail(slug: string): EmpowerDetail | undefined {
  return empowerDetails.find((m) => m.slug === slug);
}

/* ── DB 优先的运行时读取（2026-10-25 管理后台八大赋能模块接入）─────────────
 * empower_modules 表由管理后台维护（迁移 0005 已把内置详情种子化）。
 * 读取策略与 src/lib/queries 同款：DB 未配置 / 出错 / 该 slug 未发布 →
 * 回落静态 empowerDetails；「已配置且该 slug 在库里被下架」→ 返回 null
 * （页面 notFound() → 404，下架即不可见）。 */

import { getSupabaseAdmin } from '@/lib/supabase/server';

type EmpowerModuleRow = {
  slug: string;
  index_no: string;
  title: string;
  tagline: string;
  hero_desc: string | null;
  values: unknown;
  items: unknown;
  highlights: unknown;
  pending: string | null;
  related: string[] | null;
  published: boolean;
};

/** DB 行 → EmpowerDetail（逐字段形状守卫，坏数据只丢字段不 500） */
function mapEmpowerRow(row: EmpowerModuleRow): EmpowerDetail {
  const values = Array.isArray(row.values)
    ? row.values.filter(
        (v): v is { title: string; desc: string } =>
          !!v && typeof v === 'object' && typeof (v as { title?: unknown }).title === 'string' && typeof (v as { desc?: unknown }).desc === 'string',
      )
    : [];
  const items = Array.isArray(row.items) ? row.items.filter((i): i is string => typeof i === 'string') : [];
  const highlights = Array.isArray(row.highlights)
    ? row.highlights.filter(
        (h): h is { label: string; value: string; note?: string } =>
          !!h && typeof h === 'object' && typeof (h as { label?: unknown }).label === 'string' && typeof (h as { value?: unknown }).value === 'string',
      )
    : [];
  const related = Array.isArray(row.related) ? row.related.filter((r): r is string => typeof r === 'string') : [];
  return {
    slug: row.slug,
    index: row.index_no,
    title: row.title,
    tagline: row.tagline,
    heroDesc: row.hero_desc ?? row.tagline,
    values,
    items,
    highlights: highlights.length > 0 ? highlights : undefined,
    pending: row.pending ?? undefined,
    related,
  };
}

/** DB 优先读取单个赋能模块；无 DB / 出错 → null（调用方回落静态数据）。 */
export async function getEmpowerDetailLive(slug: string): Promise<EmpowerDetail | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('empower_modules').select('*').eq('slug', slug).eq('published', true).maybeSingle();
    if (error) {
      console.error(`[empower:live] 查询失败，回落内置内容：${error.message}`);
      return null;
    }
    return data ? mapEmpowerRow(data as EmpowerModuleRow) : null;
  } catch (e) {
    console.error('[empower:live] 查询异常，回落内置内容', e);
    return null;
  }
}

/** 已发布模块的 slug 列表（generateStaticParams 用，与静态详情并集）。 */
export async function listEmpowerSlugsLive(): Promise<string[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from('empower_modules').select('slug').eq('published', true);
    if (error) return [];
    return (data ?? []).map((r) => (r as { slug: string }).slug);
  } catch {
    return [];
  }
}
