import { buildLlmsTxt } from '@/lib/site/llms-txt';

/**
 * `/llms.txt` —— 面向 LLM 的站点摘要（llmstxt.org 规范）。
 *
 * 静态生成：内容取自站点配置，构建期固化，不占运行时。
 */
export const dynamic = 'force-static';

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
