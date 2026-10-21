/**
 * JSON-LD 结构化数据（PRD FR-SITE-03）。
 *
 * 搜索引擎靠它理解「这个页面是什么实体」：组织是什么、这条动态是什么文章、
 * 这门课是什么课程。渲染成 `<script type="application/ld+json">`。
 *
 * 注意：内容必须**逐字取自站点配置**，不要在这里另写一份文案 —— 否则
 * 页面文案与结构化数据会不一致，反而误导爬虫。
 *
 * ⚠️ **注入安全**：内容里可能有访客提交过的文字（留资表单里的团队名/项目名
 * 被运营复制成条目标题），而 `JSON.stringify` 不转义 `<`，`</script>` 会
 * 提前结束脚本块并让后面的内容变成可执行 HTML（存储型 XSS）。
 * 序列化统一走 `toSafeJsonLd()`（见 `src/lib/seo/safe-json.ts`），它把
 * `<` `>` `&` 转成 JSON 的 `\uXXXX` —— 爬虫读到的内容逐字不变。
 */
import { toSafeJsonLd } from '@/lib/seo/safe-json';

export default function JsonLd({
  data,
  attrs,
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
  /**
   * 附加到 `<script>` 上的属性（如 `data-breadcrumb-jsonld="BreadcrumbList"`）。
   * 结构化数据块没有稳定的 id 可选，给一个 data 属性才能被测试与调试工具定位。
   */
  attrs?: Record<string, string>;
}) {
  return (
    <script
      type="application/ld+json"
      {...attrs}
      dangerouslySetInnerHTML={{ __html: toSafeJsonLd(data) }}
    />
  );
}
