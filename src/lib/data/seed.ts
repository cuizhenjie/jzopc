/**
 * 本地种子数据 —— 与 `supabase/seed.sql` 同源。
 *
 * 重要说明：
 * 1. 智能体条目为**示例数据**，使用公开可查的真实产品与其官网根域名，
 *    仅用于让站点开箱即用、能正确渲染卡片与外链。
 *    正式清单须按原 docx 要求从 `opcstore.com/webNew/index.html#/agent` 采集后替换。
 * 2. 合作企业为参考图素材（华为/阿里/腾讯等 16 家），**授权与真实性待业务方确认**。
 * 3. 社区动态为示例资讯，替换为真实活动/沙龙内容。
 */

export type Agent = {
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string;
  tags: string[];
  external_url: string;
  provider: string;
  featured: boolean;
};

export type MarketItem = {
  slug: string;
  type: 'demand' | 'supply';
  title: string;
  category: string;
  summary: string;
  /** 完整描述段落（DB 列 body jsonb；本期种子为空数组，留给运营填写） */
  body?: string[];
  org_name: string;
  tags: string[];
  published_at: string;
};

export type Course = {
  slug: string;
  track: string;
  title: string;
  summary: string;
  /** 课程大纲段落（DB 列 body jsonb；本期种子为空数组） */
  body?: string[];
  tags: string[];
  mentor: string;
};

export type NewsPost = {
  slug: string;
  title: string;
  summary: string;
  body: string[];
  category: '沙龙' | '活动' | '资讯';
  author: string;
  published_at: string;
};

/* ── 智能体（示例数据，分类见 src/lib/site/config.ts agentCategories）────────── */
export const seedAgents: Agent[] = [
  // 办公
  { slug: 'feishu', name: '飞书', category: 'office', summary: '智能协作办公套件，多维表格与会议纪要一体', description: '面向团队协作的智能办公套件，覆盖文档、表格、会议、日程与知识库；内置 AI 助手可做纪要、总结与任务拆解，适合 OPC 团队把重复沟通交给 AI。', tags: ['协作', '文档', '会议'], external_url: 'https://www.feishu.cn', provider: '字节跳动', featured: true },
  { slug: 'dingtalk', name: '钉钉', category: 'office', summary: 'AI 助理驱动的企业沟通与流程平台', description: '以 AI 助理为核心的企业沟通与流程平台，可搭建审批、机器人与自动化流程，帮助一人公司用少量人力跑通企业内部协作。', tags: ['沟通', '流程', '机器人'], external_url: 'https://www.dingtalk.com', provider: '阿里巴巴', featured: false },
  { slug: 'microsoft-365', name: 'Microsoft 365', category: 'office', summary: 'Copilot 深度嵌入的办公生产力套件', description: 'Word/Excel/Outlook/Teams 全链路办公，Copilot 提供写作、表格分析与会议总结能力，适合需要交付标准文档与报表的创业团队。', tags: ['办公', '报告', 'AI 助手'], external_url: 'https://www.microsoft.com/microsoft-365', provider: 'Microsoft', featured: false },
  { slug: 'shimo', name: '石墨文档', category: 'office', summary: '在线文档与协作知识库', description: '轻量在线文档与知识库，支持多人协同编辑，适合需要沉淀项目资料与对外交付文档的 OPC。', tags: ['文档', '知识库'], external_url: 'https://shimo.im', provider: '石墨', featured: false },

  // 写作
  { slug: 'doubao', name: '豆包', category: 'writing', summary: '对话式 AI 助手，覆盖写作与信息整理', description: '字节跳动的对话式 AI 助手，擅长中文写作、改写、摘要与长文结构化，适合做内容与文案生产。', tags: ['中文写作', '对话'], external_url: 'https://www.doubao.com', provider: '字节跳动', featured: true },
  { slug: 'kimi', name: 'Kimi', category: 'writing', summary: '长文本阅读与写作助手', description: '擅长超长文档阅读、资料检索与长文写作，适合把行业资料快速变成结构化初稿。', tags: ['长文本', '资料整理'], external_url: 'https://kimi.moonshot.cn', provider: '月之暗面', featured: true },
  { slug: 'chatglm', name: '智谱清言', category: 'writing', summary: '国产通用大模型对话助手', description: '智谱 GLM 系列模型的对话入口，支持写作、代码与多模态理解。', tags: ['通用', '多模态'], external_url: 'https://chatglm.cn', provider: '智谱 AI', featured: false },
  { slug: 'tongyi', name: '通义', category: 'writing', summary: '阿里通用大模型助手', description: '阿里通义千问系列模型的对话入口，覆盖写作、问答与文档处理。', tags: ['通用', '文档'], external_url: 'https://tongyi.aliyun.com', provider: '阿里巴巴', featured: false },
  { slug: 'xinghuo', name: '讯飞星火', category: 'writing', summary: '中文写作与语音转写一体化', description: '讯飞的通用大模型助手，长于中文写作、语音输入与转写，兼顾文字与音频内容生产。', tags: ['写作', '语音'], external_url: 'https://xinghuo.xfyun.cn', provider: '科大讯飞', featured: false },

  // 编程
  { slug: 'cursor', name: 'Cursor', category: 'coding', summary: 'AI 优先的代码编辑器', description: '以 AI 为核心的 IDE，内置跨文件上下文理解与 Agent 模式，适合一人团队独立完成产品原型。', tags: ['IDE', 'Agent', '代码补全'], external_url: 'https://www.cursor.com', provider: 'Anysphere', featured: true },
  { slug: 'copilot', name: 'GitHub Copilot', category: 'coding', summary: '行级代码补全与 Chat 编程', description: '集成于 IDE 的编程助手，提供行级补全、Chat 与 Agent 模式，覆盖主流语言与 IDE。', tags: ['补全', 'Chat'], external_url: 'https://github.com/features/copilot', provider: 'GitHub', featured: false },
  { slug: 'lingma', name: '通义灵码', category: 'coding', summary: '阿里云智能编码助手', description: '支持代码补全、解释、单元测试生成与对话式编程，国内网络环境下访问稳定。', tags: ['补全', '单测'], external_url: 'https://lingma.aliyun.com', provider: '阿里云', featured: false },
  { slug: 'codegeex', name: 'CodeGeeX', category: 'coding', summary: '开源 AI 编程助手', description: '开源的多语言编程助手，支持补全与对话式代码生成，可私有化部署。', tags: ['开源', '私有化'], external_url: 'https://codegeex.cn', provider: '智谱 AI', featured: false },

  // 设计
  { slug: 'mastergo', name: 'MasterGo', category: 'design', summary: '国产在线 UI 设计协作工具', description: '在线 UI/UX 设计与协作平台，团队版可多人同时编辑，适合做产品界面与视觉稿。', tags: ['UI', '协作'], external_url: 'https://mastergo.com', provider: '蓝湖', featured: false },
  { slug: 'jsdesign', name: '即时设计', category: 'design', summary: '在线设计工具与设计资源库', description: '浏览器内的矢量设计工具，内置资源库与协作能力，交付成本低。', tags: ['矢量', '原型'], external_url: 'https://jsdesign.com', provider: '即时设计', featured: false },
  { slug: 'midjourney', name: 'Midjourney', category: 'design', summary: '高质量 AI 图像生成', description: '以出图质量与风格一致性见长的图像生成工具，适合概念视觉、品牌与场景素材。', tags: ['出图', '风格'], external_url: 'https://www.midjourney.com', provider: 'Midjourney', featured: true },
  { slug: 'figma', name: 'Figma', category: 'design', summary: '协作式界面设计标准工具', description: '行业标准的界面设计协作平台，支持组件系统、交互原型与开发者交付。', tags: ['界面', '原型'], external_url: 'https://www.figma.com', provider: 'Figma', featured: false },

  // 图像
  { slug: 'kling', name: '可灵 AI', category: 'image', summary: '视频与图像生成一体化', description: '快手的生成式 AI 产品，支持文生图、图生视频与数字人，适合短剧与短视频素材生产。', tags: ['文生图', '图生视频'], external_url: 'https://klingai.com', provider: '快手', featured: true },
  { slug: 'jimeng', name: '即梦', category: 'image', summary: '剪映系 AI 创作平台', description: '抖音系的 AI 创作平台，图像与视频生成一体，与剪映生态打通，适合内容流水线。', tags: ['图像', '视频', '生态'], external_url: 'https://jimeng.jianying.com', provider: '字节跳动', featured: false },
  { slug: 'wanxiang', name: '通义万相', category: 'image', summary: '阿里通义图像生成', description: '通义千问的图像生成与编辑能力，支持风格化与局部重绘。', tags: ['生成', '编辑'], external_url: 'https://tongyi.aliyun.com/wanxiang/', provider: '阿里云', featured: false },
  { slug: 'liblib', name: 'LiblibAI', category: 'image', summary: '中文提示词模型社区', description: '以中文提示词与模型社区见长的生成平台，模型与风格资源丰富。', tags: ['中文提示词', '社区'], external_url: 'https://www.liblib.art', provider: '哩布哩布', featured: false },

  // 视频
  { slug: 'runway', name: 'Runway', category: 'video', summary: 'AI 视频生成与后期工具', description: '生成式视频创作套件，覆盖文生视频、换背景与视频后期，海外短片团队常用。', tags: ['文生视频', '后期'], external_url: 'https://runwayml.com', provider: 'Runway', featured: true },
  { slug: 'hailuo', name: '海螺 AI', category: 'video', summary: '高运动幅度视频生成', description: 'MiniMax 出品的视频生成模型产品，擅长大动作与镜头运动。', tags: ['视频', '运镜'], external_url: 'https://hailuoai.video', provider: 'MiniMax', featured: false },
  { slug: 'capcut', name: '剪映', category: 'video', summary: 'AI 剪辑与内容生产工作台', description: '以剪辑为入口的短视频生产工具，含智能字幕、成片与模板，适合批量内容产出。', tags: ['剪辑', '字幕'], external_url: 'https://www.capcut.cn', provider: '字节跳动', featured: false },
  { slug: 'tongyi-video', name: '通义万相视频', category: 'video', summary: '阿里系视频生成', description: '通义千问体系下的视频生成能力，覆盖文生视频与图生视频。', tags: ['文生视频'], external_url: 'https://tongyi.aliyun.com/wanxiang/', provider: '阿里云', featured: false },

  // 音频
  { slug: 'elevenlabs', name: 'ElevenLabs', category: 'audio', summary: '多语言语音合成与配音', description: '高质量多语种 TTS 与声音克隆，适合有声内容、有声书与多语言本地化。', tags: ['配音', '声音克隆'], external_url: 'https://elevenlabs.io', provider: 'ElevenLabs', featured: false },
  { slug: 'iflyrec', name: '讯飞听见', category: 'audio', summary: '会议转写与实时字幕', description: '专业级语音转写与会议纪要，支持多语种与说话人分离，适合访谈与课程整理。', tags: ['转写', '会议纪要'], external_url: 'https://www.iflyrec.com', provider: '科大讯飞', featured: false },
  { slug: 'tongyi-tingwu', name: '通义听悟', category: 'audio', summary: '音视频内容理解与总结', description: '阿里云的音视频内容理解工具，可转写、摘要并提取关键信息。', tags: ['音视频', '摘要'], external_url: 'https://tingwu.aliyun.com', provider: '阿里云', featured: false },
  { slug: 'moyin', name: '魔音工坊', category: 'audio', summary: '中文商业配音工具', description: '中文场景的商用配音与音频制作工具，支持多音色与批量产出。', tags: ['配音', '商用'], external_url: 'https://www.moyin.com', provider: '魔音工坊', featured: false },
];

/* ── 供需市场（示例数据）────────────────────────────────────────────────── */
export const seedMarket: MarketItem[] = [
  { slug: 'demand-retail-ai-ops', type: 'demand', title: '连锁零售 AI 运营助手（寻源 + 选品）', category: 'AI 电商', summary: '年营收 3 亿的连锁零售品牌，需要能自动完成选品数据分析、竞品监控与商品文案生成的 AI 助手，期望先试点 1 个品类。', org_name: '某全国性零售品牌', tags: ['AI 电商', '选品', '文案'], published_at: '2026-10-12' },
  { slug: 'demand-mcu-diagnosis', type: 'demand', title: '工业设备预测性维护方案', category: '智能硬件', summary: '制造企业需对产线设备做故障预测与工单派发，希望由 OPC 团队交付 3 个月 POC，硬件数据已脱敏。', org_name: '某装备制造集团', tags: ['工业', '预测维护', 'POC'], published_at: '2026-10-08' },
  { slug: 'demand-medical-llm', type: 'demand', title: '医疗科普内容生成与合规审校', category: 'AI + 医疗', summary: '医药园区内的机构需要面向患者的科普内容批量生产与合规审校流程，期望引入 AI 工作流。', org_name: '某医药健康机构', tags: ['AI 医疗', '内容合规'], published_at: '2026-09-28' },
  { slug: 'demand-cross-border', type: 'demand', title: '跨境电商多平台智能运营', category: 'AI 电商', summary: '需要搭建覆盖多平台的选品、定价与投放自动化系统，强调数据看板与可回溯决策。', org_name: '某跨境电商卖家', tags: ['跨境', '自动化'], published_at: '2026-09-20' },
  { slug: 'supply-ai-video', type: 'supply', title: 'AI 短剧批量生产能力', category: 'AIGC', summary: '提供剧本生成、分镜、AI 配音与成片交付全链路服务，已完成 40+ 条短剧交付。', org_name: '某 AIGC 内容工作室', tags: ['短剧', 'AIGC', '成片'], published_at: '2026-10-10' },
  { slug: 'supply-agent-dev', type: 'supply', title: '企业级智能体定制开发', category: '智能体', summary: '基于主流大模型做业务流程拆解、工具接入与部署交付，提供从 PoC 到上线的完整服务。', org_name: '某 AI 解决方案团队', tags: ['智能体', '定制', '交付'], published_at: '2026-10-05' },
  { slug: 'supply-aigc-training', type: 'supply', title: 'AIGC 团队培训与工作流搭建', category: 'AI 培训', summary: '为传统行业团队做 AIGC 工具落地培训与流程改造，已服务 10+ 企业内训。', org_name: '某企业培训服务商', tags: ['培训', '工作流'], published_at: '2026-09-30' },
  { slug: 'supply-data-annotation', type: 'supply', title: '高质量数据标注与清洗', category: '数据服务', summary: '面向模型训练的多模态数据标注、清洗与合规审查，支持小批量快速交付。', org_name: '某数据服务机构', tags: ['数据', '合规'], published_at: '2026-09-15' },
];

/* ── 课程（示例数据）────────────────────────────────────────────────────── */
export const seedCourses: Course[] = [
  { slug: 'ai-ecommerce-basics', track: 'AI电商', title: 'AI 电商运营从 0 到 1', summary: '用 AI 完成选品分析、商品文案、详情页与客服话术的完整闭环，课程结业即可独立运营一个店铺。', tags: ['选品', '文案', '客服'], mentor: '集智商学院教研组' },
  { slug: 'aigc-content-system', track: 'AIGC', title: 'AIGC 内容生产系统搭建', summary: '从选题库、提示词库到批量产出与人工校审，建立可持续跑的内容流水线。', tags: ['提示词', '流水线', '校审'], mentor: '集智商学院教研组' },
  { slug: 'ai-comic-production', track: 'AI漫剧', title: 'AI 漫剧脚本、分镜与制作', summary: '用 AI 完成剧本改编、分镜设计、角色一致性控制与成片输出，覆盖短剧全流程。', tags: ['剧本', '分镜', '一致性'], mentor: '集智商学院教研组' },
  { slug: 'bigdata-engineer-path', track: '大数据工程师', title: '大数据工程师就业路径', summary: 'Hadoop、Spark、Flink 实战 + 数据平台项目，配套岗位对接与就业推荐。', tags: ['Hadoop', 'Spark', 'Flink'], mentor: '集智商学院教研组' },
  { slug: 'short-video-operation', track: '短视频运营', title: '短视频账号增长与商业化', summary: '选题、脚本、剪辑、投放与数据复盘全链路，面向真实账号的运营实战。', tags: ['选题', '投放', '复盘'], mentor: '集智商学院教研组' },
];

/* ── 社区动态（示例数据）────────────────────────────────────────────────── */
export const seedNews: NewsPost[] = [
  {
    slug: 'opc-salon-2026-10',
    title: '集智 AI OPC 社区首场创业沙龙：一个人怎么接下第一笔订单',
    summary: '社区首批入驻团队分享从零到第一笔订单的完整路径，以及社区在需求对接与资源撮合中的具体动作。',
    body: [
      '10 月的这场沙龙没有做产品发布会，我们把时间全部留给了三支入驻不到半年的团队，讲他们怎么拿到第一笔订单。',
      '其中一支做工业 AI 的团队分享了他们的路径：先不要做大而全的产品，而是把母公司一个「觉得麻烦但天天在做」的环节拆出来做成了可交付的服务。第一个客户就是社区内的另一家企业，三个月后才有外部客户。',
      '第二位分享者是做 AIGC 内容的，她提到社区最有用的不是工位，而是「能直接找到要人的那个人」——入驻企业之间天然存在供需关系。',
      '第三位讲的是踩坑：早期把精力放在做平台而不是做交付，三个月没有现金流入。这是 OPC 最常见的问题，社区之后会专门做交付方法论的分享。',
      '沙龙固定每月举办，报名方式见「社区动态」页面的订阅入口。',
    ],
    category: '沙龙',
    author: '集智 AI OPC 社区',
    published_at: '2026-10-15',
  },
  {
    slug: 'compute-market-open',
    title: '算力超市开放首批算力券申请通道',
    summary: '社区完成首批算力供应商对接，GPU 按需租用通道上线，同时开放算力券补贴申请。',
    body: [
      '算力超市正式开放首批申请。入驻团队可以按需租用 GPU，不必再逐一去和云厂商谈合同。',
      '首批接入的算力覆盖训练与推理两类常见规格，具体型号、单价与到账周期会在申请后由专人给出。',
      '算力券补贴同步开放申请，审核按团队阶段与项目情况分档。',
      '需要注意的是：算力不是越多越好。社区会先了解你的项目阶段与月度预算，再给建议，避免团队一上来就囤算力。',
    ],
    category: '资讯',
    author: '集智 AI OPC 社区',
    published_at: '2026-10-09',
  },
  {
    slug: 'academy-first-cohort',
    title: '集智商学院首批课程与 AIGC 认证同步开放',
    summary: '五条课程线与就业服务链路正式上线，完成测评即可进入课程，课程结束进入岗位推荐环节。',
    body: [
      '集智商学院首批开放 AI 电商、AIGC、AI 漫剧、大数据工程师、短视频运营五条课程线。',
      '学习路径按「职业测评 → 技能培训 → 项目实战 → 求职面试 → 就业推荐 → 入职跟踪」六步设计，每一步都有明确产出。',
      'AIGC 认证与研学班同步开放申请。认证面向已有实操经验、希望对外证明能力的学员；研学班面向刚起步、需要一个完整项目的学员。',
      '课程与认证均采用线下授课 + 项目制的方式，社区内企业会提供真实项目作为练习素材。',
    ],
    category: '活动',
    author: '集智商学院',
    published_at: '2026-10-02',
  },
  {
    slug: 'space-open-3000',
    title: '集智空间首期开放：3000㎡ 的工位、会议室与直播影棚',
    summary: '首期空间完成交付，工位、独立办公室、会议室、路演厅与直播影棚全部到位，支持拎包入驻。',
    body: [
      '集智空间首期 3000 余平米已完成交付并开放预约。',
      '空间包含开放工位、独立办公室、多间会议室、可做路演的公共厅与带绿幕的直播影棚，配套工商财税法务一站式服务窗口。',
      '丰台区人力资源服务中心与青创会已驻场，办事窗口就在楼里，不用再跑几个地方。',
      '入驻方式：提交意向表单后由社区对接沟通，确认需求与工位类型后安排看房。',
    ],
    category: '资讯',
    author: '集智 AI OPC 社区',
    published_at: '2026-09-25',
  },
];

/* ── 供需市场副标与智能体副标 ───────────────────────────────────────────── */
export const marketHero = {
  title: '加入集智 AI OPC 交易市场',
  subtitle:
    '加入集智 AI OPC 交易市场 上架智能体能力，发布项目需求，链接产业伙伴，共筑 AI 产业新生态',
} as const;
