/**
 * JSON-LD 注入安全：把 JSON 序列化成可安全放进 `<script>` 标签的文本。
 *
 * ## 为什么必须转义
 *
 * `JSON.stringify` **不转义 `<`**。而 HTML 解析器遇到 `</script>` 就会结束脚本块 ——
 * 于是 `</script>` 之后的内容会变成真实 HTML 被解析执行。
 *
 * 这是**存储型 XSS**，且在本项目里链路可达：访客在留资表单里填的
 * 「团队名称 / 项目名称」→ 运营把它复制成供需条目或动态的标题 → 标题进到
 * JSON-LD 的 `name` 字段 → 每一个访问该页面的访客都会中招。
 *
 * 转义 `<` / `>` / `&` 成 JSON 的 `\uXXXX` 转义：JSON 解析器会还原成原字符，
 * **语义完全不变**（爬虫读到的还是原始标题），但 HTML 解析器再也找不到
 * 脚本块的结束标记。`U+2028` / `U+2029` 同样要处理 —— 它们在 JS 字符串字面量里
 * 是行终止符，未转义会让 JSON.parse 直接抛错。
 *
 * 抽成独立模块（而不是写在组件里）是为了能写单测：Node 的类型剥离不支持 JSX，
 * 组件文件无法在 `node --test` 里加载。
 */
export function toSafeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
