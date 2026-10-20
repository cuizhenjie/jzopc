/**
 * JSON-LD 结构化数据（PRD FR-SITE-03）。
 *
 * 搜索引擎靠它理解「这个页面是什么实体」：组织是什么、这条动态是什么文章、
 * 这门课是什么课程。渲染成 `<script type="application/ld+json">`。
 *
 * 注意：内容必须**逐字取自站点配置**，不要在这里另写一份文案 —— 否则
 * 页面文案与结构化数据会不一致，反而误导爬虫。
 */
export default function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // 内容来自受控的站点数据，不是用户输入，无需额外转义；仍用 JSON.stringify 兜底
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
