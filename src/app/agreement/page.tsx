import type { Metadata } from 'next';

/**
 * 公约与入驻须知：入驻意向表「同意条款」里两份文件的承载页
 * （/apply 的勾选框链接到 #covenant 与 #notice 两个锚点，新标签页打开）。
 *
 * 页面为静态内容，复用参考站视觉类（pagehead / sec / jreq 等，
 * 作用域见 .opc-site）。公约条款为社区治理文本，修订需同步运营。
 */
export const metadata: Metadata = {
  title: { absolute: '公约与入驻须知 · 集智 AI OPC 社区' },
  description:
    '集智 AI OPC 空间使用公约与入驻须知：社区协作规范、入驻要求、申请材料与六步入驻流程。',
  alternates: { canonical: '/agreement' },
};

const COVENANT_ITEMS: Array<[string, string]> = [
  ['实名诚信', '入驻信息须真实有效；主体、联系人或赛道发生变更，应及时向社区更新。'],
  ['合规经营', '遵守国家法律法规，不得利用社区空间与资源从事任何违法活动。'],
  ['空间共处', '爱护公共空间与共享设施，规范使用工位，遵守楼宇安全管理规定。'],
  ['供需真实', '在供需发布中提供真实、可兑现的需求或能力信息，不发布虚假或夸大内容。'],
  ['尊重知产', '尊重他人知识产权与他人成果；对外交付中涉及 AI 生成内容时应主动说明。'],
  ['信息边界', '不滥用社区成员信息，未经同意不将其用于入驻对接之外的用途。'],
  ['资源用途', '算力、课程等开通权益仅限本团队使用，不得转售或变相转让。'],
  ['名义边界', '以「集智 AI OPC 社区」名义对外发声或组织活动，需事先向社区运营报备。'],
  ['违规处理', '违反公约按情节轻重分级处理：提醒告知 → 暂停部分权益 → 清退；涉嫌违法的移交有关部门。'],
  ['公约修订', '社区可根据运营情况修订本公约，重大变更将提前在社区渠道公示。'],
];

const REQUIREMENT_ITEMS = [
  '企业注册时长不超过 3 年',
  '主营业务方向与科技或 AI 领域相关',
  '企业在保人员 ≤ 10 人，属轻量化创业团队',
  '企业无重大违法犯罪记录',
  '企业注册地位于北京丰台区，或可新迁移至丰台区',
  '申请认定前，企业在大模型 / 算力方向已有集智 OPC 至少 1000 元算力投入，可提供发票、消费凭证',
];

const PROCESS_ITEMS: Array<[string, string]> = [
  ['网上申报', '提交意向表与资质材料'],
  ['完整性初审', '材料完整性与资质核对'],
  ['管委会复审', '复审通过后进入洽谈'],
  ['面核洽谈', '确认空间与赋能方案'],
  ['签约入驻', '签署协议、领取工位'],
  ['权益开通', '算力、工具与订单开通'],
];

export default function AgreementPage() {
  return (
    <>
      <section className="pagehead">
        <div className="wrap">
          <h1>公约与入驻须知</h1>
          <p className="lead">
            申请入驻集智 AI OPC 空间前，请阅读并同意《集智 AI OPC 空间使用公约》与入驻须知。
            两份文件同样是入驻后的社区协作依据。
          </p>
        </div>
      </section>

      <section className="sec sec--bg" id="covenant">
        <div className="wrap">
          <div className="shead shead--center">
            <span className="eyebrow">COVENANT · 使用公约</span>
            <h2>集智 AI OPC 空间使用公约</h2>
            <p className="sub">十条社区公约，约束空间内的协作与资源使用。</p>
          </div>
          <ol className="jreq">
            {COVENANT_ITEMS.map(([title, body], index) => (
              <li key={title}>
                <i>{String(index + 1).padStart(2, '0')}</i>
                <span>
                  <b>{title}</b>　{body}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sec" id="notice">
        <div className="wrap">
          <div className="shead shead--center">
            <span className="eyebrow">NOTICE · 入驻须知</span>
            <h2>入驻须知</h2>
            <p className="sub">入驻要求、申请材料与流程，均以提交意向表时的最新口径为准。</p>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h3>入驻要求（6 项需同时满足）</h3>
            <ol className="jreq">
              {REQUIREMENT_ITEMS.map((item, index) => (
                <li key={item}>
                  <i>{String(index + 1).padStart(2, '0')}</i>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="card" style={{ padding: '24px', marginTop: '18px' }}>
            <h3>申请材料</h3>
            <ol className="jreq">
              <li>
                <i>01</i>
                <span>入驻意向表（本站「申请入驻」页在线提交）</span>
              </li>
              <li>
                <i>02</i>
                <span>营业执照或团队证明材料</span>
              </li>
              <li>
                <i>03</i>
                <span>算力投入凭证（发票、消费凭证）</span>
              </li>
            </ol>
          </div>

          <div className="card" style={{ padding: '24px', marginTop: '18px' }}>
            <h3>六步入驻</h3>
            <ol className="jreq">
              {PROCESS_ITEMS.map(([title, body], index) => (
                <li key={title}>
                  <i>{String(index + 1).padStart(2, '0')}</i>
                  <span>
                    <b>{title}</b>　{body}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="card" style={{ padding: '22px 24px', marginTop: '18px' }}>
            <h3>对接与参观</h3>
            <p style={{ fontSize: '13.5px', lineHeight: '1.9', marginTop: '8px' }}>
              提交意向表后，我们会在 1 个工作日内与您联系；如需预约参观，可在沟通时一并说明。
              空间地址：北京市丰台区集美家居大红门店3号厅2层 集智OPC社区 · 首期 3000+ ㎡，
              开放时间：周一至周五 9:30 – 18:30（参观请提前预约）。
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
