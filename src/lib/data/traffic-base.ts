/**
 * 流量超市（/traffic）——「集智AIGC新媒体流量基地」页面文案。
 *
 * 口径来源：2026-10-26 业务方提供的基地介绍全文（七个板块）。这里只做结构化拆分，
 * 事实、数字与措辞保持原文；唯一的排版归一是把「300w+」写成「300万+」，
 * 与同一板块里其它案例的「万+」单位一致。
 *
 * /traffic 之前整页跳转到独立站 th.jimei.cn（2026-10-23），现改回站内页面；
 * 八大赋能里的「流量赋能」（/empower/traffic）是另一张赋能概览页，不在本文件口径内。
 */

export type TrafficPillar = { label: string; text: string };
export type TrafficAdvantage = { title: string; desc: string };
export type TrafficBusinessItem = { title: string; desc: string };
export type TrafficBusiness = {
  /** B 端 = 企业，S 端 = 院校，C 端 = 个人学员 */
  tag: 'B端服务' | 'S端服务' | 'C端服务';
  title: string;
  subtitle?: string;
  lead?: string;
  items: TrafficBusinessItem[];
};
export type TrafficGrowthPoint = { title: string; desc: string };
export type TrafficBaseSite = { name: string; role: string };
export type TrafficCase = {
  brand: string;
  /** 卡片主数字：SSR 直接输出终值，客户端进入视口后 count-up（见 anim/CountUp） */
  metric: { value: number; suffix: string; label: string };
  /** 原文逐条事实，主数字只是其中一条的放大 */
  facts: string[];
};
export type TrafficAudience = { to: string; text: string };

export const trafficBase = {
  name: '集智AIGC新媒体流量基地',
  slogan: '产教融合·实战育人·打造全国可复制的数智人才与流量生态',

  /** 一、基地简介（Who We Are） */
  intro: {
    paragraph:
      '集智AIGC新媒体流量基地，是集美控股集团旗下北京集美科技有限公司重点打造的产教融合标杆项目，也是集团2026年AI新赛道核心落地载体。基地依托集美控股集团40余年产业积淀，覆盖家居商业综合体、地产开发、科创金融投资、国际贸易、大健康等全链条产业资源，致力于打造面向数字经济和AIGC新媒体领域的数智人才孵化平台。',
    industries: ['家居商业综合体', '地产开发', '科创金融投资', '国际贸易', '大健康'],
    pillars: [
      { label: '使命', text: '打通教学与产业连接壁垒，为产业输出实战型AIGC新媒体人才，建设一流全媒体流量基地。' },
      { label: '愿景', text: '打造可复制、可推广的产教融合AIGC新媒体服务生态。' },
      { label: '核心价值观', text: '实战育人、商业共生、务实创新、多方共赢。' },
    ] satisfies readonly TrafficPillar[],
    values: ['实战育人', '商业共生', '务实创新', '多方共赢'],
  },

  /** 二、核心优势（Why Choose Us） */
  advantages: [
    {
      title: '跨界顶配师资团队',
      desc: '基地核心团队采用“商业操盘手 + 产教融合专家 + 资深校招导师”的跨界组合。由15年互联网全链路操盘手、亿级项目缔造者领衔，团队曾主导10亿级战略并购，操盘多场GMV突破千万的直播大促，成功孵化多个百万级粉丝达人账号，并服务华为、联想、立白、中国茶叶、八马茶业等300余家头部企业。',
    },
    {
      title: '真实商业项目驱动',
      desc: '将企业真实新媒体运营需求引入校园实训环节，让学生在真实的商业交付中掌握“AI工具+短视频+直播”全链路技能，实现“培训—实训—就业”一站式闭环。',
    },
    {
      title: '规模化矩阵产能',
      desc: '依托全国高校生源池与独创的实训体系，基地具备月产数万条商业短视频、常态化运营数百个账号矩阵的产能，以远低于市场的成本为企业提供高质量内容交付，解决行业产能不足痛点。',
    },
    {
      title: '平台化数字生态',
      desc: '自主研发双端小程序系统，打通“学生-企业-基地”壁垒。学生可展示作品、接单赚取实践补贴；企业可定向选购服务、发布代运营需求、招募优质人才，实现供需的高效匹配与全链路透明化管理。',
    },
  ] satisfies readonly TrafficAdvantage[],

  /** 三、核心业务生态（What We Do） */
  businesses: [
    {
      tag: 'B端服务',
      title: '企业商业交付',
      lead: '为品牌方及实体商家提供极致低成本、高转化的全域营销服务，做企业省心的“全域增长外脑”：',
      items: [
        { title: '短视频代拍代剪', desc: '提供混剪口播、实拍种草、千川投流素材等标准化视频包（支持百条/千条级批量交付）。' },
        { title: '账号代运营', desc: '涵盖抖音、小红书、视频号等平台的内容策划、矩阵铺设、数据复盘全案服务。' },
        { title: '直播代播代投', desc: '提供常态化直播间代播、千川及本地推代投流、投流素材迭代。' },
        { title: 'IP孵化与达人种草', desc: '企业创始人IP全案打造、素人IP矩阵裂变、本地生活探店种草（涵盖大健康、家居、本地生活、电商等垂类）。' },
      ],
    },
    {
      tag: 'B端服务',
      title: 'FDE（前沿部署工程师）AI落地专项服务',
      subtitle: '打通企业AI应用的“最后一公里”',
      lead: '依托产教融合基地的实战交付能力，为企业提供FDE（Forward Deployed Engineer，前沿部署工程师）专项服务。进入企业真实业务环境，把AI大模型与智能体真正用起来。',
      items: [
        { title: '需求诊断与场景筛选', desc: '深入企业现场，梳理业务流程、数据现状与权限体系，找到AI最容易见效的高价值切入场景，而非从“技术Demo”出发。' },
        { title: '智能体（Agent）构建与部署', desc: '基于企业实际数据与系统环境，设计并搭建可运行的AI智能体工作流，完成接口联调、权限对接与生产级部署，确保AI能力嵌入日常业务流程。' },
        { title: '业务结果验证与知识转移', desc: '以可量化的业务指标（如线索成本降低、内容产能提升、人工工时节省）作为交付验收标准；同时完成对企业团队的培训与知识转移，确保系统脱离FDE后仍能自主运行。' },
      ],
    },
    {
      tag: 'S端服务',
      title: '院校产教共建',
      items: [
        { title: '校企订单班', desc: '联合高校开设“AIGC新媒体实训班”，定制化培养符合企业需求的人才。' },
        { title: '课程与实训室共建', desc: '将AIGC应用、短视频爆款逻辑、直播运营体系转化为高校实训课程；共建专业直播间与实训室。' },
        { title: '师资赋能', desc: '为高校教师提供新媒体前沿技能与商业项目操盘培训。' },
      ],
    },
    {
      tag: 'C端服务',
      title: '人才孵化与社会培训',
      items: [
        { title: '青年就业实训', desc: '面向在校生提供AI全链路部署、智能体应用、短视频拍剪、直播代播等实战培训。' },
        { title: '银发与失业人群培训', desc: '面向社会开展新媒体职业技能培训，助力再就业与灵活创业。' },
        { title: 'OPC（一人公司）创业孵化', desc: '为优秀学员提供供应链、系统与流量支持，扶持自主接单与创业。' },
      ],
    },
  ] satisfies readonly TrafficBusiness[],

  /** 四、人才成长闭环（How We Empower Students） */
  growth: {
    lead: '基地不仅提供商业产能，更承载着高质量就业的社会责任。',
    ladderTitle: '阶梯式成长路径',
    ladder: ['实训学员', '商业交付师', '签约员工', '助教', '带教', '项目合伙人'],
    points: [
      { title: '真实收益与荣誉', desc: '学生在校即可参与合规商业项目，获得企业奖学金；同时获得真实项目履历、实习证明及工信领域相关认证资源对接。' },
      { title: '高质量就业推荐', desc: '依托丰富的产业资源，精准对接MCN机构、品牌新媒体、本地生活服务商，提供简历优化、面试辅导，打通“毕业即就业”闭环。' },
    ] satisfies readonly TrafficGrowthPoint[],
  },

  /** 五、全国基地网络（Our Network） */
  network: {
    lead: '依托平台化运营模式，集智AIGC新媒体流量基地正面向全国进行标准化复制，构建“总部-大区-基地-班级”的层级网络。',
    tiers: ['总部', '大区', '基地', '班级'],
    bases: [
      { name: '北京总部基地', role: '核心研发与交付中枢' },
      { name: '常熟流量基地', role: '华东区域交付中心' },
      { name: '上海流量基地', role: '长三角商业化前沿阵地' },
    ] satisfies readonly TrafficBaseSite[],
    more: '更多城市基地持续拓展中……',
    note: '各基地运营均严格遵守国家法律法规、平台规则及合作院校规章制度，保障学生权益与数据安全。',
  },

  /** 六、标杆服务案例（Success Stories）——原文允许「品牌 Logo 墙或核心案例数据战报」，
   *  仓库里没有这几家品牌的 Logo 资产，按数据战报呈现，不拼凑 Logo。 */
  cases: [
    {
      brand: '八马茶业',
      metric: { value: 2400, suffix: '万+', label: '中秋超品日 GMV' },
      facts: ['中秋超品日GMV突破2400万+', '营销曝光量5亿+', '包揽茶类目TOP1'],
    },
    {
      brand: '康师傅',
      metric: { value: 1900, suffix: '%', label: 'GMV 提升' },
      facts: ['双播专场单日GMV突破200万+', 'GMV提升1900%'],
    },
    {
      brand: '立白',
      metric: { value: 630, suffix: '万+', label: '自播次月 GMV' },
      facts: ['自播首月GMV 100万+', '次月突破630万+'],
    },
    {
      brand: '卫龙',
      metric: { value: 7, suffix: '天', label: 'GMV 破百万' },
      facts: ['7天完成品牌矩阵直播间布局', '7天实现GMV破百万'],
    },
    {
      brand: '大健康垂类IP',
      metric: { value: 300, suffix: '万+', label: '全网粉丝' },
      facts: ['全网粉丝300万+', '单日变现20-30万', '打通公私域全域变现路径'],
    },
  ] satisfies readonly TrafficCase[],

  /** 七、合作邀请（Join Us） */
  invitation: {
    lead: '无论您是寻求低成本全域增长的品牌企业、寻求产教融合落地的高等院校，还是寻求新媒体技能提升的求职者，集智AIGC新媒体流量基地都期待与您携手。',
    audiences: [
      { to: '致企业', text: '来这里，用极具性价比的成本，获得数百人专业团队的内容交付与流量赋能。' },
      { to: '致院校', text: '来这里，共筑实训基地，让人才培养与产业需求无缝对接。' },
      { to: '致学员', text: '来这里，从课堂走向职场，在真实项目中掌握AI新媒体硬核技能，赚取第一桶金。' },
    ] satisfies readonly TrafficAudience[],
    channels: ['商务合作', '院校共建', '实训报名'],
    compliance:
      '本基地未经学校书面同意，不以学校名义开展商业活动；不向学生收取培训费、押金、设备费；相关商业账号权属、内容知识产权及数据归属均在正式协议中另行约定。学分认定、就业推荐等事项均遵守国家法律法规及院校规章制度。',
  },
} as const;

/**
 * 小程序二维码（合作邀请板块）。
 *
 * 业务方要求官网放小程序二维码，但图片尚未提供 —— 这里保持 `null`，页面就不渲染二维码位，
 * 「扫描下方二维码」的引导语也随之收起，只保留顾问联系方式与留言表单（不用占位图冒充）。
 * 拿到图片后：放到 `public/opc/visual/traffic-miniapp-qr.png`（建议 ≥ 480×480），
 * 把下面改成 `{ src: '/opc/visual/traffic-miniapp-qr.png', alt: '集智AIGC新媒体流量基地小程序二维码' }`。
 */
export const trafficMiniappQr: { src: string; alt: string } | null = null;
