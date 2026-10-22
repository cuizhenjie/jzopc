import { site } from '@/lib/site/config';
import { leadTypeLabel } from '@/lib/lead/schema';
import { WEBHOOK_ENDPOINT } from '@/lib/net/webhook-endpoint';

/**
 * 留资通知：企业 IM webhook + 邮件（两者均可选，失败静默，绝不影响入库）。
 * 本模块只负责「通知」，不参与任何业务判断。
 */

/** 通知载荷：与线索表落库字段对应 */
export type LeadNotifyPayload = {
  leadType: string;
  name: string;
  contactType: string;
  contact: string;
  orgName?: string;
  sourcePage: string;
};

/** 通知通道超时（毫秒） */
const WEBHOOK_TIMEOUT_MS = 5000;
const EMAIL_TIMEOUT_MS = 10000;

/** Resend HTTP API（不引入 SDK，原生 fetch 调用） */
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * 通知运营：邮件 + 企业 IM webhook（均可选，失败静默）
 * 每条通道各自兜底，任一通道失败都不会抛到调用方。
 */
export async function notify(data: LeadNotifyPayload): Promise<void> {
  await Promise.all([notifyWebhook(data), notifyEmail(data)]);
}

/* ── 企业 IM webhook（原有行为原样保留）──────────────────────────────── */

/** 企业 IM 文本通知 */
async function notifyWebhook(data: LeadNotifyPayload): Promise<void> {
  const text = `【集智 AI OPC 新线索】${data.leadType} | ${data.name} | ${data.contact} | ${data.sourcePage}`;

  // WEBHOOK_ENDPOINT 在模块加载时已经 assertSafeOutboundUrl 校验（SSRF 白名单）
  if (WEBHOOK_ENDPOINT) {
    try {
      await fetch(WEBHOOK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ msgtype: 'text', text: { content: text } }),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      });
    } catch (e) {
      console.error('[lead:notify-webhook-failed]', e);
    }
  }
}

/* ── 邮件通道（可选：收件人与 API Key 都配置才发送）──────────────────── */

/** 线索类型中文名（未知类型回退为原始值） */
function leadTypeText(leadType: string): string {
  return (leadTypeLabel as Record<string, string>)[leadType] ?? leadType;
}

/** 联系方式类型中文名 */
function contactTypeText(contactType: string): string {
  return contactType === 'email' ? '邮箱' : '手机号';
}

/** 转义 HTML，避免用户输入破坏邮件结构 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 线索详情回跳链接：运营看板。
 *
 * ⚠️ 绝不把 OPS_TOKEN 拼进 URL —— 会经由邮件正文、浏览器历史、
 * Referer 头与网关访问日志四处泄露后台口令。这里只给看板地址，
 * 由运营在自己浏览器的 cookie 里持有口令（见 src/lib/ops/auth.ts）。
 */
function leadDetailUrl(): string {
  const base = site.url.replace(/\/+$/, '');
  return `${base}/admin/leads`;
}

/** 邮件通知（发件人可通过 LEAD_NOTIFY_EMAIL_FROM 覆盖） */
async function notifyEmail(data: LeadNotifyPayload): Promise<void> {
  const to = process.env.LEAD_NOTIFY_EMAIL_TO;
  const apiKey = process.env.RESEND_API_KEY;
  // 两项都配置才发送，否则静默跳过
  if (!to || !apiKey) return;

  const from = process.env.LEAD_NOTIFY_EMAIL_FROM || 'onboarding@resend.dev';
  const rows: Array<[string, string]> = [
    ['线索类型', leadTypeText(data.leadType)],
    ['姓名', data.name],
    [`联系方式（${contactTypeText(data.contactType)}）`, data.contact],
  ];
  if (data.orgName) rows.push(['组织', data.orgName]);
  rows.push(['来源页', data.sourcePage]);

  const listHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#4D5153;white-space:nowrap;">${escapeHtml(
          k,
        )}</td><td style="padding:6px 0;color:#142F59;font-weight:600;">${escapeHtml(v)}</td></tr>`,
    )
    .join('');

  const detailUrl = leadDetailUrl();
  const html = `<div style="font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#142F59;">
  <p style="font-size:16px;margin:0 0 12px;">【集智 AI OPC 新线索】</p>
  <table style="border-collapse:collapse;font-size:14px;line-height:1.7;">${listHtml}</table>
  <p style="font-size:14px;margin:20px 0 0;">
    <a href="${escapeHtml(detailUrl)}" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#1D7FBA;color:#ffffff;text-decoration:none;">查看线索详情</a>
  </p>
  <p style="font-size:12px;color:#4D5153;margin:12px 0 0;">${escapeHtml(detailUrl)}</p>
</div>`;

  const subject = `【集智 AI OPC 新线索】${leadTypeText(data.leadType)} · ${data.name}`;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        // 线索邮箱可直接回复给留资人
        ...(data.contactType === 'email' ? { reply_to: data.contact } : {}),
      }),
      signal: AbortSignal.timeout(EMAIL_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error('[lead:notify-email-failed]', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.error('[lead:notify-email-failed]', e);
  }
}
