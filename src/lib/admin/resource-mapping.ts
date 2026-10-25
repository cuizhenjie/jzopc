/**
 * 资源模块的纯数据映射工具（**不依赖 next/cache**，可进客户端 bundle）。
 *
 * 从 resource-api.ts 拆出的原因：resource-configs（字段配置，被客户端
 * resource-tables/ResourceForm 引用）需要这些映射；而 resource-api 顶层
 * import 了 next/cache —— 一旦被客户端图引入，Next 会把整条链判为非法
 * （"revalidatePath only works in a Server Component"），整组 /admin 路由 500。
 */

/** 富文本 HTML → body jsonb 单段（空 HTML 存空数组） */
export function bodyFromHtml(bodyHtml: string): string[] {
  const trimmed = bodyHtml.trim();
  return trimmed.length > 0 ? [trimmed] : [];
}

/** 「YYYY-MM-DD / YYYY-MM-DDTHH:mm」→ ISO；空串 → null（由 DB default 兜底的使用方自行处理） */
export function isoOrNull(value: string): string | null {
  if (!value) return null;
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** 表单 JSON 文本 → 值；空串 → []；非法 JSON → null（由 zod 前置校验拦截，理论上到不了这里） */
export function jsonArrayFromFormText(text: string): unknown[] | null {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const v = JSON.parse(trimmed);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export function jsonObjectFromFormText(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    const v = JSON.parse(trimmed);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
