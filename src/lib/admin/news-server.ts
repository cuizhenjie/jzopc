import { revalidatePath } from 'next/cache';

/**
 * 后台改动新闻后让前台 ISR 缓存立即失效（页面 revalidate=300，最长滞后 5 分钟；
 * 不主动失效的话，运营发布后前台要等一轮才可见）。
 *
 * 服务端专用：依赖 next/cache，不能被客户端组件引用。
 */
export function revalidateNewsPages(slug?: string): void {
  revalidatePath('/');
  revalidatePath('/news');
  if (slug) revalidatePath(`/news/${slug}`);
}
