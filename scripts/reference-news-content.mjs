/**
 * 参考站社区动态 → news_posts 行动态数据。
 *
 * 正文保留完整 HTML，由公开详情页的 sanitize-html 白名单统一净化；
 * 不在解析阶段剥掉加粗、图片、图注与原文链接。
 */

function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(html, name) {
  const match = html.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : '';
}

/** @param {string} html 参考站 /news 的 <main> HTML */
export function parseReferenceNews(html) {
  const articles = html.split(/<article class="nitem/).slice(1);
  return articles.map((raw, index) => {
    const body = raw.slice(0, raw.indexOf('</article>'));
    const dateBlock = body.match(/<div class="nitem__date">([\s\S]*?)<\/div>/)?.[1] ?? '';
    const day = stripTags(dateBlock.match(/<b>([\s\S]*?)<\/b>/)?.[1] ?? '');
    const month = stripTags(dateBlock.match(/<span>([\s\S]*?)<\/span>/)?.[1] ?? '');
    const cover = attr(body.match(/<div class="nitem__ph">([\s\S]*?)<\/div>/)?.[1] ?? '', 'src');
    const bd = body.match(/<div class="nitem__bd">([\s\S]*?)<\/div>\s*<span class="nitem__more"/)?.[1] ?? '';
    const category = stripTags(bd.match(/<span class="ntag">([\s\S]*?)<\/span>/)?.[1] ?? '');
    const title = stripTags(bd.match(/<h3>([\s\S]*?)<\/h3>/)?.[1] ?? '');
    const summary = stripTags(bd.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '');
    const bodyBlock = body.match(
      /<div class="nitem__body">([\s\S]*?)<\/div>/,
    )?.[1]?.trim() ?? '';

    return {
      slug: `opc-ref-${String(index + 1).padStart(2, '0')}`,
      title,
      summary,
      category,
      published_at: `${month}-${day.padStart(2, '0')}T09:00:00+08:00`,
      cover_url: cover || null,
      body: bodyBlock ? [bodyBlock] : [],
      status: 'published',
      author: '集智 AI',
    };
  }).filter((article) => article.title);
}
