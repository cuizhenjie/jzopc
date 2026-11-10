/**
 * 前台表单与后台线索之间的映射契约（src/lib/opc/form-payload.ts）。
 *
 * ── 为什么改写（2026-11-10 全站复刻后）──────────────────────────────────
 *
 * 旧版测的是 `src/components/opc/interaction-model.ts`：
 *   - facetMatches / parseCategories（旧站工具卡的搜索与分类解析）
 *   - validateReplicaFields（旧站登录 / 注册表单的本地校验）
 *   - parseStatNumber（旧站 banner 指标的数字解析）
 *
 * 这些**随旧站一起下线**：
 *   - interaction-model.ts 整个文件已删除（旧的 233 张工具卡 / 登录注册表单都不存在了）；
 *   - 参考站的智能体目录、筛选与搜索由 `ReferenceInteractions.tsx` 接管，
 *     入驻意向表与供需发布表单**直连后台**（POST /api/leads）。
 *
 * 删除的旧断言（逐条说明）：
 *   - 「facetMatches / parseCategories（旧站分类别名与 JSON 解析）」
 *     → 新架构的分类是**后台分类 slug**，chips 的 data-cat 与卡片的
 *     data-opc-categories 同源，不需要别名表；解析规则换成了
 *     parseAgentCategories（见下）。
 *   - 「validateReplicaFields（旧站登录/注册/入驻表单的本地校验）」
 *     → 参考站没有登录 / 注册页（表单只有入驻意向表与供需发布表单），
 *       且校验由组件直接做（校验失败时加 .bad 类），不再有统一的字段错误模型。
 *   - 「parseStatNumber（旧站 500+/1000+ 指标解析）」
 *     → 旧站首页指标墙已换成参考站的 .hero__stats（由后台 site_stats 接管）。
 *
 * 新契约：
 *   1. 入驻意向表 → leads：申请主体类型 → subjectType、团队人数 → teamSize、
 *      需要哪些赋能 → message 的一行、同意条款 → agreeTerms；
 *   2. 供需发布表单 → 发布文案 + leads（leadType=market）；
 *   3. 两个表单都 POST 到 /api/leads；
 *   4. 智能体分类 slug 与 chips 同源。
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  APPLY_LEAD_TYPE,
  APPLY_NEEDS_LINE_PREFIX,
  APPLY_SUBJECT_TYPE_FALLBACK,
  APPLY_SUBJECT_TYPE_MAP,
  APPLY_TEAM_SIZE_FALLBACK,
  APPLY_TEAM_SIZE_MAP,
  LEAD_ENDPOINT,
  MARKET_LEAD_TYPE,
  buildApplyLeadPayload,
  buildMarketCardText,
  buildMarketLeadPayload,
  filterAgents,
  matchesAgentQuery,
  mapApplySubjectType,
  mapApplyTeamSize,
  parseAgentCategories,
  parseMarketFormPayload,
  type ApplyFormValues,
  type MarketFormValues,
} from '@/lib/opc/form-payload';
import { agentCategories } from '@/lib/site/config';

const interactionSource = readFileSync('src/components/opc/ReferenceInteractions.tsx', 'utf8');

const applyValues: ApplyFormValues = {
  type: '创业团队',
  size: '6–10 人',
  need: ['空间工位', '智能体'],
  team: '某某智能科技',
  contact: '张三',
  tel: '13800138000',
  track: 'AI 应用 / 智能体开发',
  intro: '做 AI 客服，给连锁药店用',
  agree: true,
};

const marketValues: MarketFormValues = {
  org: '某某智能科技',
  oneline: 'AI 问诊助手',
  contact: '李四',
  tel: '13900139000',
  needTypes: ['找业务'],
  detail: '连锁药店要 AI 问诊助手，对接现有 ERP',
  budget: '面议',
  when: '1 个月内',
  giveTypes: ['智能体开发'],
  product: '医药零售知识库智能体',
  boundary: '不含硬件采购',
  giveWays: ['项目制'],
  price: '面议',
  scope: '社区内公开',
};

describe('入驻意向表 · 字段映射', () => {
  test('申请主体类型 → subjectType（5 个选项收敛成 3 个后台枚举）', () => {
    assert.equal(mapApplySubjectType('一人公司（OPC）'), '个人');
    assert.equal(mapApplySubjectType('创业团队'), '团队');
    assert.equal(mapApplySubjectType('已注册企业'), '企业');
    assert.equal(mapApplySubjectType('高校 / 科研团队'), '团队');
    assert.equal(mapApplySubjectType('服务机构'), '企业');
    // 未知 / 空值回落到「团队」，不提交脏值
    assert.equal(mapApplySubjectType('未知选项'), APPLY_SUBJECT_TYPE_FALLBACK);
    assert.equal(mapApplySubjectType(''), APPLY_SUBJECT_TYPE_FALLBACK);
    assert.equal(mapApplySubjectType(null), APPLY_SUBJECT_TYPE_FALLBACK);
  });

  test('映射表覆盖参考站 select[name=type] 的全部选项', () => {
    assert.deepEqual(Object.keys(APPLY_SUBJECT_TYPE_MAP), [
      '一人公司（OPC）',
      '创业团队',
      '已注册企业',
      '高校 / 科研团队',
      '服务机构',
    ]);
  });

  test('团队人数 → teamSize（取区间上限，30 人以上记 31）', () => {
    assert.equal(mapApplyTeamSize('1 人（一人公司）'), 1);
    assert.equal(mapApplyTeamSize('2–5 人'), 5);
    assert.equal(mapApplyTeamSize('6–10 人'), 10);
    assert.equal(mapApplyTeamSize('11–30 人'), 30);
    assert.equal(mapApplyTeamSize('30 人以上'), 31);
    assert.equal(mapApplyTeamSize('未知'), APPLY_TEAM_SIZE_FALLBACK);
    assert.equal(mapApplyTeamSize(undefined), APPLY_TEAM_SIZE_FALLBACK);
  });

  test('映射表覆盖参考站 select[name=size] 的全部选项', () => {
    assert.deepEqual(Object.keys(APPLY_TEAM_SIZE_MAP), [
      '1 人（一人公司）',
      '2–5 人',
      '6–10 人',
      '11–30 人',
      '30 人以上',
    ]);
  });

  test('teamSize 落在后台 schema 允许的区间内（1..999）', () => {
    for (const value of Object.values(APPLY_TEAM_SIZE_MAP)) {
      assert.ok(Number.isInteger(value) && value >= 1 && value <= 999, String(value));
    }
  });

  test('需要哪些赋能 → message 追加一行；同意条款 → agreeTerms', () => {
    const payload = buildApplyLeadPayload(applyValues);
    assert.equal(payload.leadType, APPLY_LEAD_TYPE);
    assert.equal(payload.message, `做 AI 客服，给连锁药店用\n${APPLY_NEEDS_LINE_PREFIX}空间工位、智能体`);
    assert.equal(payload.agreeTerms, true);
  });

  test('没勾选任何赋能时 message 只有简介（不留空行）', () => {
    const payload = buildApplyLeadPayload({ ...applyValues, need: [] });
    assert.equal(payload.message, '做 AI 客服，给连锁药店用');
    assert.ok(!payload.message.includes(APPLY_NEEDS_LINE_PREFIX));
  });

  test('未勾选条款 → agreeTerms=false（服务端会拒绝）', () => {
    assert.equal(buildApplyLeadPayload({ ...applyValues, agree: false }).agreeTerms, false);
  });

  test('基础字段与来源落位正确（值做 trim）', () => {
    const payload = buildApplyLeadPayload({ ...applyValues, team: ' 某某科技 ', contact: ' 张三 ', tel: ' 13800138000 ' });
    assert.equal(payload.name, '张三');
    assert.equal(payload.contact, '13800138000');
    assert.equal(payload.contactType, 'phone');
    assert.equal(payload.orgName, '某某科技');
    assert.equal(payload.track, 'AI 应用 / 智能体开发');
    assert.equal(payload.sourcePage, '/apply');
    assert.equal(payload.sourceRef, 'join-form');
  });
});

describe('供需发布表单 · 发布文案与线索载荷', () => {
  test('需求文案按参考站结构逐行生成', () => {
    const text = buildMarketCardText('need', marketValues);
    assert.deepEqual(text.split('\n'), [
      '【需求】AI 问诊助手',
      '名称：某某智能科技',
      '类型：找业务',
      '要什么：连锁药店要 AI 问诊助手，对接现有 ERP',
      '预算 / 方式：面议',
      '时间：1 个月内',
      '公开范围：社区内公开',
      '联系：李四 13900139000',
    ]);
  });

  test('供给文案按参考站结构逐行生成（合作边界为空则整行省略）', () => {
    const text = buildMarketCardText('give', marketValues);
    assert.deepEqual(text.split('\n'), [
      '【供给】AI 问诊助手',
      '名称：某某智能科技',
      '能提供：智能体开发',
      '产品与适合谁：医药零售知识库智能体',
      '合作边界：不含硬件采购',
      '合作方式：项目制｜面议',
      '可响应：1 个月内',
      '公开范围：社区内公开',
      '联系：李四 13900139000',
    ]);
    const noBoundary = buildMarketCardText('give', { ...marketValues, boundary: '   ' });
    assert.ok(!noBoundary.includes('合作边界'));
    assert.equal(noBoundary.split('\n').length, 8);
  });

  test('多个类型 / 方式用「 / 」连接', () => {
    const text = buildMarketCardText('need', { ...marketValues, needTypes: ['找业务', '找资源'] });
    assert.ok(text.includes('类型：找业务 / 找资源'));
  });

  test('供需线索载荷：leadType=market，message 即发布文案', () => {
    const payload = buildMarketLeadPayload('need', marketValues);
    assert.equal(payload.leadType, MARKET_LEAD_TYPE);
    assert.equal(payload.message, buildMarketCardText('need', marketValues));
    assert.equal(payload.sourcePage, '/market');
    assert.equal(payload.sourceRef, 'market:need');
    assert.equal(payload.subjectType, '团队');
    assert.equal(payload.contactType, 'phone');
    assert.equal(payload.name, '李四');
    assert.equal(payload.orgName, '某某智能科技');
    assert.equal(buildMarketLeadPayload('give', marketValues).sourceRef, 'market:give');
  });

  test('没填联系人时回落「社区成员」（不提交空 name）', () => {
    const payload = buildMarketLeadPayload('need', { ...marketValues, contact: '' });
    assert.equal(payload.name, '社区成员');
  });

  test('formPayload 携带 kind 与表单原始取值，入库后供后台结构化展示', () => {
    const payload = buildMarketLeadPayload('need', marketValues);
    assert.equal(payload.formPayload?.kind, 'need');
    assert.equal(payload.formPayload?.oneline, marketValues.oneline);
    assert.equal(payload.formPayload?.org, marketValues.org);
    assert.deepEqual(payload.formPayload?.needTypes, marketValues.needTypes);
    const give = buildMarketLeadPayload('give', marketValues);
    assert.equal(give.formPayload?.kind, 'give');
    assert.deepEqual(give.formPayload?.giveTypes, marketValues.giveTypes);
  });
});

describe('parseMarketFormPayload（后台解析 leads.form_payload）', () => {
  test('合法载荷 → kind + 完整取值面', () => {
    const payload = buildMarketLeadPayload('give', marketValues).formPayload;
    const parsed = parseMarketFormPayload(payload);
    assert.ok(parsed);
    assert.equal(parsed.kind, 'give');
    assert.equal(parsed.values.product, marketValues.product);
    assert.deepEqual(parsed.values.giveWays, marketValues.giveWays);
  });

  test('宽容读取：非对象 / kind 非法 → null（回退展示 message 原文）', () => {
    assert.equal(parseMarketFormPayload(null), null);
    assert.equal(parseMarketFormPayload('market:need'), null);
    assert.equal(parseMarketFormPayload([1, 2]), null);
    assert.equal(parseMarketFormPayload({ kind: 'other' }), null);
  });

  test('宽容读取：字段缺失给缺省值，数组混型过滤非字符串', () => {
    const parsed = parseMarketFormPayload({ kind: 'need', oneline: '找人', needTypes: ['算力', 7, null] });
    assert.ok(parsed);
    assert.equal(parsed.values.oneline, '找人');
    assert.equal(parsed.values.org, '');
    assert.deepEqual(parsed.values.needTypes, ['算力']);
  });
});

describe('两个表单都直连后台线索接口', () => {
  test('端点是 /api/leads', () => {
    assert.equal(LEAD_ENDPOINT, '/api/leads');
  });

  test('组件的两次提交都走 LEAD_ENDPOINT，且带对应 leadType', () => {
    assert.ok(interactionSource.includes("from '@/lib/opc/form-payload'"), '组件必须复用共享映射层');
    assert.ok(interactionSource.includes('LEAD_ENDPOINT'), '组件必须使用共享端点常量');
    assert.ok(interactionSource.includes('buildApplyLeadPayload'), '入驻表单必须走共享映射');
    assert.ok(interactionSource.includes('buildMarketLeadPayload'), '供需表单必须走共享映射');
    // 两处 fetch 都用 LEAD_ENDPOINT
    const fetches = [...interactionSource.matchAll(/fetch\(\s*([^,]+),/g)].map((match) => match[1].trim());
    assert.equal(fetches.length, 2, '入驻表单与供需表单各提交一次');
    for (const target of fetches) assert.equal(target, 'LEAD_ENDPOINT');
    // 载荷里带 leadType
    assert.equal(buildApplyLeadPayload(applyValues).leadType, 'apply');
    assert.equal(buildMarketLeadPayload('need', marketValues).leadType, 'market');
  });

  test('两个载荷都能通过后台 leadSchema 的枚举校验', () => {
    for (const leadType of [buildApplyLeadPayload(applyValues).leadType, buildMarketLeadPayload('need', marketValues).leadType]) {
      assert.ok(['apply', 'market'].includes(leadType), leadType);
    }
    for (const payload of [buildApplyLeadPayload(applyValues), buildMarketLeadPayload('need', marketValues)]) {
      assert.ok(['个人', '团队', '企业'].includes(payload.subjectType), payload.subjectType);
      assert.equal(payload.contactType, 'phone');
      assert.ok(payload.message.length <= 1000, 'message 不得超后台 1000 字上限');
    }
  });
});

describe('智能体分类与 chips 同源', () => {
  test('分类 slug 唯一且名称非空', () => {
    const slugs = agentCategories.map((category) => category.slug);
    assert.equal(new Set(slugs).size, slugs.length, '分类 slug 必须唯一');
    for (const category of agentCategories) {
      assert.ok(category.name.trim().length > 0, `${category.slug} 缺名称`);
    }
  });

  test('参考站的 18 个分类都在配置里（slug 与后台一致）', () => {
    // slug 基准 = 数据库 agent_categories 表（由灌库脚本的 CATEGORY_SLUGS 写入）。
    const seedSrc = readFileSync('scripts/seed-reference-content.mjs', 'utf8');
    const mapped = [...seedSrc.matchAll(/^\s+'?([^'\s:]+)'?:\s*'([a-z0-9-]+)',$/gm)]
      .filter((m) => /[\u4e00-\u9fa5]/.test(m[1]))
      .map((m) => m[2]);
    const slugs: Set<string> = new Set(agentCategories.map((category) => category.slug));
    for (const slug of mapped) {
      assert.ok(slugs.has(slug), `缺少参考站分类 ${slug}`);
    }
    assert.equal(mapped.length, 18, '参考站应有 18 个分类');
  });

  test('分类 slug 是 ASCII slug（可安全进 data-cat 属性与 URL）', () => {
    for (const category of agentCategories) {
      assert.match(category.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, category.slug);
    }
  });

  test('parseAgentCategories 支持 JSON 数组与逗号分隔两种形态', () => {
    assert.deepEqual(parseAgentCategories('["ai-office","ai-coding"]'), ['ai-office', 'ai-coding']);
    assert.deepEqual(parseAgentCategories('ai-office,ai-coding'), ['ai-office', 'ai-coding']);
    assert.deepEqual(parseAgentCategories('{invalid'), ['{invalid']);
    assert.deepEqual(parseAgentCategories(''), []);
    assert.deepEqual(parseAgentCategories(undefined), []);
  });

  test('卡片分类与 chip 的 slug 同值比对（不做别名映射）', () => {
    const card = { text: '验收智能体', search: '办公类', categories: 'ai-office' };
    assert.equal(matchesAgentQuery(card, 'ai-office', ''), true);
    assert.equal(matchesAgentQuery(card, 'ai-coding', ''), false);
    assert.equal(matchesAgentQuery(card, 'all', ''), true);
    // 中文分类名不再命中（chips 用的是 slug）
    assert.equal(matchesAgentQuery(card, 'AI办公工具', ''), false);
  });

  test('filterAgents 同时作用分类与关键词', () => {
    const cards = [
      { text: 'LivePPT AI 演示文稿', search: 'PPT', categories: 'hot' },
      { text: 'AI 代码助手', search: '编程', categories: 'ai-coding' },
    ];
    assert.deepEqual(filterAgents(cards, 'all', '').length, 2);
    assert.deepEqual(filterAgents(cards, 'ai-coding', '').map((c) => c.text), ['AI 代码助手']);
    assert.deepEqual(filterAgents(cards, 'all', 'ppt').map((c) => c.text), ['LivePPT AI 演示文稿']);
    assert.deepEqual(filterAgents(cards, 'all', '不存在的关键词'), []);
  });
});

describe('表单提交反馈与输出安全', () => {
  test('供需表单检查 HTTP 与业务状态，失败时明确提示且恢复提交按钮', () => {
    assert.ok(interactionSource.includes('const response = await fetch(LEAD_ENDPOINT'));
    assert.ok(interactionSource.includes('await response.json'));
    assert.ok(interactionSource.includes('!response.ok || !result.ok'));
    assert.ok(interactionSource.includes('文案已生成，但后台提交失败'));
    assert.ok(interactionSource.includes('文案已生成并提交后台'));
    assert.ok(interactionSource.includes("button.textContent = '提交中…'"));
    assert.ok(interactionSource.includes('button.disabled = false'));
  });

  test('供需提交状态写入结果卡，不再静默吞错', () => {
    assert.ok(interactionSource.includes("sdOut?.querySelector('.sdout__hd span')"));
    assert.ok(interactionSource.includes("sdOut?.querySelector('.sdout__note')"));
    assert.ok(!interactionSource.includes('网络失败不阻断卡片生成'));
  });

  test('入驻成功反馈使用 textContent，不把机构或联系人拼进 HTML', () => {
    assert.ok(interactionSource.includes('joinOk.textContent'));
    assert.ok(!interactionSource.includes('joinOk.innerHTML'));
  });
});


describe('社区动态 · 整卡跳转而非折叠', () => {
  test('客户端不再注册 nitem 折叠与 hash 展开行为', () => {
    assert.ok(!interactionSource.includes("querySelectorAll<HTMLElement>('.nitem__hd')"));
    assert.ok(!interactionSource.includes("document.querySelectorAll('.nitem.on')"));
    assert.ok(!interactionSource.includes("target.classList.add('on')"));
  });
});
