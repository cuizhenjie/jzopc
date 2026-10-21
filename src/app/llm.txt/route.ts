import { buildLlmsTxt } from '@/lib/site/llms-txt';

/**
 * `/llm.txt` —— `/llms.txt` 的别名。
 *
 * 规范文件名是 `llms.txt`（llmstxt.org），但社区里两种写法都有工具在用，
 * 这里两者都提供，避免因为路径拼写不同而取不到。
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
