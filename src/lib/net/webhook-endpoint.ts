/**
 * 出站网络端点配置：模块加载即校验，非法配置直接抛错拒绝启动。
 *
 * 为什么独立成模块：
 * 1. SSRF 防线的单一事实源 —— 校验逻辑与被校验常量放在一起，谁引用谁受保护；
 * 2. 校验发生在 import 时（fail-fast），而不是每次请求时；
 * 3. URL 虽来自运维配置的环境变量而非用户输入，但配置面同样是外部输入，
 *    必须按不可信数据处理（仅 http/https + 拒绝环回/内网/保留地址）。
 */

/** SSRF 白名单校验：仅允许 http/https，拒绝环回 / 内网 / 保留地址 */
function assertSafeOutboundUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`仅允许 http/https 出站请求，当前协议 ${url.protocol}`);
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
  const blocked =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '::1' ||
    host === '0.0.0.0' ||
    (isIPv4 &&
      (host.startsWith('127.') ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        host.startsWith('169.254.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(host)));
  if (blocked) throw new Error(`拒绝环回 / 内网 / 保留地址：${host}`);
  return url;
}

/**
 * 企业 IM webhook 目标（LEAD_NOTIFY_WEBHOOK）。
 * 模块加载时已过 assertSafeOutboundUrl 校验；配置非法直接抛错 ——
 * 宁可启动失败，也不带着可被引导进内网的 URL 上线。未配置为空串。
 */
export const WEBHOOK_ENDPOINT: string = (() => {
  const raw = process.env.LEAD_NOTIFY_WEBHOOK;
  return raw ? assertSafeOutboundUrl(raw).href : '';
})();
