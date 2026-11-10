import { revalidatePath } from 'next/cache';

/**
 * 后台改动新闻/活动后让前台 ISR 缓存立即失效（页面 revalidate=300，最长滞后 5 分钟；
 * 不主动失效的话，运营发布后前台要等一轮才可见）。
 *
 * 失效矩阵（契约 docs/14-动态内容契约.md 第 5 节）：
 * - `/news`：主站社区动态列表
 * - `/newsdetail`：DB 驱动的文章详情（按 id 查询参数读取）
 * - `/`：首页「新闻动态」区块
 * - `/sitemap.xml`：/newsdetail 条目读 DB
 *
 * 服务端专用：依赖 next/cache，不能被客户端组件引用。
 */
export function revalidateNewsPages(_slug?: string): void {
  revalidatePath('/');
  revalidatePath('/news');
  revalidatePath('/newsdetail');
  revalidatePath('/sitemap.xml');
}
