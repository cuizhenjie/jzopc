-- 集智 AI OPC 社区 · 迁移 0005：管理后台「规划中模块」落地配套
--
-- 内容：
--   1) 八大赋能内置详情种子化（empower_modules）——管理后台上线后，公开页
--      /empower/[slug] 改为「DB 优先、内置回落」读取；本迁移把站点内置的
--      8 个模块详情写入 DB，保证两边内容一致，运营直接在后台就能改。
--   2) 首页统计数字种子化（site_stats）——同理，后台「统计数字」页管理
--      的就是首页数字墙，先种入与站点配置一致的四项。
--
-- 幂等策略：on conflict do nothing。重复执行不覆盖数据 ——
--   后台一旦改过内容，重跑迁移不能把它冲回去；首次部署则拿到与内置
--   内容一致的起点。

-- ── 0) 智能体分类引用表（agents.category 的 FK 目标）──────────────────────
-- 真库上该表此前从未种子化，agents 模块任何写入都会 23503。
-- 与站点配置（site/config.agentCategories）保持一致；on conflict do nothing。

insert into agent_categories (slug, name, sort_order)
values
('office',  '办公', 1),
('writing', '写作', 2),
('coding',  '编程', 3),
('design',  '设计', 4),
('image',   '图像', 5),
('video',   '视频', 6),
('audio',   '音频', 7)
on conflict (slug) do nothing;

-- ── 1) 八大赋能 ────────────────────────────────────────────────────────────

insert into empower_modules (slug, index_no, title, tagline, hero_desc, values, items, highlights, lead_type, pending, related, sort_order, published)
values
('space', '01', '集智空间', '拎包入驻的工位与独立办公室，会议、路演、直播一站配齐。',
 '首期 3000 余平米，位于北京丰台大红门。工位、独立办公室、会议室、路演厅与直播影棚一站配齐，工商财税法务办事窗口就在楼里。',
 '[{"title":"拎包入驻","desc":"工位与独立办公室即刻可用，不需要等待装修与采购周期，先把产品做出来。"},{"title":"会议与路演","desc":"共享会议室与路演厅按需预约，客户来了有地方见，投资人来了有地方讲。"},{"title":"直播影棚","desc":"带绿幕的直播影棚在楼内，AIGC 内容产能与真人出镜可以同日完成。"},{"title":"办事窗口在楼里","desc":"丰台区人力资源服务中心与青创会已驻场，工商、财税、法务不用再跑几个地方。"}]'::jsonb,
 '["开放工位与独立办公室","共享会议室与洽谈区","路演厅与直播影棚","工商注册 / 财税 / 法务一站式","园区班车与生活配套"]'::jsonb,
 '[{"label":"首期面积","value":"3000+ ㎡"},{"label":"位置","value":"丰台 · 大红门"},{"label":"启动运营","value":"2026 年 10 月"}]'::jsonb,
 'space', null, '{academy,enterprise,market}', 1, true),
('agents', '02', '智能体', '把大模型封装成能直接干活的数字员工，不开技术门槛。',
 '汇聚覆盖办公、写作、编程、设计、图像、视频、音频等场景的 AI 智能体，帮你把重复的活儿交出去。',
 '[{"title":"不开技术门槛","desc":"按场景挑就行，不用理解模型、不用配环境，选中就能用。"},{"title":"场景全覆盖","desc":"从写文档到出视频，从写代码到做设计，一个人常用的工具基本都在这里。"},{"title":"持续更新","desc":"智能体目录持续扩充，新增条目会同步到社区市场与本页面。"}]'::jsonb,
 '["办公协同","写作与长文","编程与代码","设计出图","图像生成","视频生成","音频与配音"]'::jsonb,
 '[]'::jsonb,
 null, null, '{academy,market,traffic}', 2, true),
('compute', '03', '算力超市', 'GPU 按需租用，大模型一次接入，还能对接算力券补贴。',
 '把分散的算力供应商接到一个入口上。社区团队按你的项目阶段与月度预算给建议，不鼓励一上来就囤算力。',
 '[{"title":"按需取用","desc":"训练与推理的常见规格都接进来了，用多少付多少，不必提前签年框。"},{"title":"一次接入","desc":"大模型 API 统一入口，不用逐个去和各家云厂商谈合同与适配。"},{"title":"算力券对接","desc":"社区协助对接算力券与相关补贴，按项目情况分档申报。"}]'::jsonb,
 '["GPU 按需租用","大模型 API 统一接入","算力券与补贴对接","优先渲染通道申请","成本优化建议"]'::jsonb,
 '[]'::jsonb,
 'compute', '具体 GPU 型号、单价与到账周期以社区团队给出的方案为准，正在整理中。', '{agents,capital,market}', 3, true),
('academy', '04', '集智商学院', '实战课程、AIGC 认证、研学班与就业推荐，一条线把人补齐。',
 '学AI技能拿高薪Offer让未来，从这里开始。提供AI人才培养与就业服务，助力个人成长与企业数字化升级。',
 '[{"title":"实战教学","desc":"线下授课 + 真实项目，不用拿练习题糊弄人。"},{"title":"AIGC 认证","desc":"面向已有实操经验、希望对外证明能力的学员。"},{"title":"研学班","desc":"面向刚起步、需要完成一个完整项目的学员。"},{"title":"就业推荐","desc":"课程结束后进入岗位推荐与入职跟踪环节。"}]'::jsonb,
 '["AI 电商","AIGC","AI 漫剧","大数据工程师","短视频运营"]'::jsonb,
 '[]'::jsonb,
 'course', null, '{space,agents,enterprise}', 4, true),
('enterprise', '05', '企服超市', '人、财、税、法四项基础服务打包，后台的事交给专业的人。',
 '工商财税法务是每个团队都要重复做的事。把它们打包给专业的人，你只保留真正该你做的事。',
 '[{"title":"人","desc":"社保、公积金、招聘与劳动关系的基础事务。"},{"title":"财","desc":"记账、报税、账务梳理与成本结构建议。"},{"title":"税","desc":"税务合规与专项事项处理。"},{"title":"法","desc":"合同审阅、知识产权与常见商事法律问题。"}]'::jsonb,
 '["工商注册与变更","代理记账与报税","合同与法务顾问","知识产权与商标","人事社保代办"]'::jsonb,
 '[]'::jsonb,
 'enterprise', '具体服务清单、承办方与计费方式正在与服务商确认，整理完成后在此公示。', '{space,capital,market}', 5, true),
('market', '06', '供需市场', '社区内撮合，外部接 1000+ 家企业需求，把能力直接变成收入。',
 '加入集智 AI OPC 交易市场 上架智能体能力，发布项目需求，链接产业伙伴，共筑 AI 产业新生态。',
 '[{"title":"供需发布","desc":"发布 AI 项目需求或智能体服务，高效撮合产业合作机会。"},{"title":"智能匹配","desc":"依托社区生态，精准对接开发者、投资方与产业资源。"},{"title":"能力展示","desc":"上架AI产品与落地案例，打造个人与项目品牌影响力。"},{"title":"产业共创","desc":"融入集智 AI 开放社区，携手伙伴共建 AI 智能体产业生态。"}]'::jsonb,
 '["需求发布与承接","能力与案例展示","社区内优先撮合","外部企业需求对接"]'::jsonb,
 '[]'::jsonb,
 'market', null, '{agents,traffic,capital}', 6, true),
('traffic', '07', '流量赋能', 'AIGC 内容产能就在社区里，让产品先被看见，再谈成交。',
 '依托已入驻社区的 AIGC 流量生产基地，把内容产能放在创业者触手可及的地方——先被看见，才谈得上成交。',
 '[{"title":"产能在场","desc":"AIGC 内容生产团队就在社区里，需求可以直接对接人，不用走采购流程。"},{"title":"先被看见","desc":"产品上线前的素材、投放与内容测试，社区能提供就近的支持。"},{"title":"从流量到成交","desc":"流量不是终点，最终还是要回到订单与收入。"}]'::jsonb,
 '["AIGC 内容生产","产品素材与视觉","投放与账号运营","内容测试与迭代"]'::jsonb,
 '[]'::jsonb,
 'traffic', '集智AIGC新媒体流量基地介绍与赋能机制的资料正在整理中，正式内容将补充到本页。', '{market,agents,academy}', 7, true),
('capital', '08', '资本政策', '对接创投机构，协助申报 AI OPC 相关政策，把钱的问题也解决。',
 '创业早期最缺的两样东西：启动资金和政策支持。社区把对接与申报协助放在同一张桌子上。',
 '[{"title":"创投对接","desc":"对接关注 AI 与一人公司的投资机构，以真实交付能力而不是 PPT 做判断。"},{"title":"政策申报协助","desc":"协助理解并申报 AI OPC 相关政策，减少创业者自己摸政策的时间。"},{"title":"把时间还给产品","desc":"跑腿的事交给社区，创业者把时间花在打磨产品和接客户上。"}]'::jsonb,
 '["创投机构对接","AI OPC 政策申报协助","算力券与数据券通道","融资材料预审建议"]'::jsonb,
 '[]'::jsonb,
 'capital', '具体政策清单、申报流程与对接机构名单正在整理中。', '{compute,enterprise,market}', 8, true)
on conflict (slug) do nothing;

-- ── 2) 首页统计数字 ────────────────────────────────────────────────────────

insert into site_stats (key, value, suffix, label, sort_order)
values
('agents',   500,  '+', '入驻智能体',   1),
('creators', 1000, '+', '活跃创业者',   2),
('courses',  100,  '+', '精品课程',     3),
('partners', 50,   '+', '生态伙伴企业', 4)
on conflict (key) do nothing;

-- ── 3) 校验 ────────────────────────────────────────────────────────────────

do $$
declare
  n_empower int;
  n_stats int;
begin
  select count(*) into n_empower from empower_modules where published;
  if n_empower < 8 then
    raise exception '[FAIL] empower_modules 已发布模块不足 8 个（% 个）', n_empower;
  end if;
  select count(*) into n_stats from site_stats;
  if n_stats < 4 then
    raise exception '[FAIL] site_stats 种子不足（% 条）', n_stats;
  end if;
  raise notice '[OK] empower_modules % 条 / site_stats % 条', n_empower, n_stats;
end $$;
