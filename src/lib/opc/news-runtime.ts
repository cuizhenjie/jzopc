/** 社区动态的运行时渲染层（2026-11-10 对齐参考站 .nitem 结构）。
 *
 * 契约：docs/14-动态内容契约.md
 * - /news：DB（news_posts）渲染列表卡；未配库 / 查询异常 → **空列表**（DB 唯一事实源）
 * - /newsdetail?id=：数字 id → slug=opc-N；slug → 查 DB；库内无此文 → 404
 *
 * 列表保留参考站的卡片布局，整个 .nitem__hd 原生链接到
 * /newsdetail?id=<slug>，不再绑定折叠行为。
 *
 * 本模块服务端专用（依赖 @/lib/queries → supabase admin 客户端）。
 */
import sanitizeHtml from 'sanitize-html';
import { getNewsPosts, getNewsPost } from '@/lib/queries';
import { seedNews } from '@/lib/data/seed';
import { REPLICA_SITE_NAME, escapeText, getReplicaPage, type ReplicaPageContent } from '@/lib/opc/content';
import { LEGACY_SLUG_PREFIX, NEWSDETAIL_ID_PATTERN } from '@/lib/opc/taxonomy';
import { replaceBlockInner } from '@/lib/opc/dom';
import articleShell from './generated/article-shell.json' with { type: 'json' };

/** 卡片渲染的最小输入面：DB 行与种子行都结构满足（cover_url 仅 DB 行有） */
export interface NewsCardSource {
  slug: string;
  title: string;
  summary: string;
  category: string;
  published_at: string;
  cover_url?: string | null;
  /** 可选以兼容数据库行；列表不渲染，仅详情页使用完整正文。 */
  body?: string[];
}

/** 详情渲染的输入面（比卡片多正文字段） */
export interface NewsArticleSource extends NewsCardSource {
  body: string[];
}

/** cover_url 缺省时的占位图（站内素材） */
const FALLBACK_COVER = '/opc/reference/img/news-wuzhen-opc.jpg';

const CHEVRON_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>';

/* ── 日期 ──────────────────────────────────────────────────────────────── */

/** published_at（ISO 日期或日期时间）→ YYYY-MM-DD；不合法 → 空串 */
export function formatNewsDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

/** YYYY-MM-DD → 参考站卡片的「日 + 年月」两段式 */
function splitDate(value: string): { day: string; month: string } {
  const date = formatNewsDate(value);
  if (!date) return { day: '--', month: '' };
  return { day: date.slice(8, 10), month: date.slice(0, 7) };
}

/** slug → 详情页 id：opc-N → N，其余原样 */
export function newsDetailIdOfSlug(slug: string): string {
  if (slug.startsWith(LEGACY_SLUG_PREFIX)) {
    const suffix = slug.slice(LEGACY_SLUG_PREFIX.length);
    if (/^[1-9]\d{0,9}$/.test(suffix)) return suffix;
  }
  return slug;
}

function resolveCover(url: string | null | undefined): string {
  const value = (url ?? '').trim();
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (value.startsWith('https://')) return value;
  return FALLBACK_COVER;
}

/* ── 正文净化 ──────────────────────────────────────────────────────────── */

const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
    'strong', 'b', 'em', 'i', 'u', 's', 'span', 'div', 'section', 'figure',
    'figcaption', 'img', 'a', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'hr',
  ],
  allowedAttributes: {
    '*': ['style', 'class'],
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
  },
  /** class 白名单：只放行详情页排版组件，防任意类名注入 */
  allowedClasses: {
    p: ['nsrc'],
    figure: ['nfig'],
    div: ['nnotice'],
    span: ['nnotice'],
  },
  allowedStyles: {
    '*': {
      'font-size': [/^\d{1,3}(?:\.\d+)?(?:px|rem|em|%)$/],
      'font-weight': [/^(?:normal|bold|[1-9]00)$/],
      'font-style': [/^(?:normal|italic|oblique)$/],
      'line-height': [/^(?:normal|\d+(?:\.\d+)?|\d+(?:\.\d+)?(?:px|rem|em|%))$/],
      'text-align': [/^(?:left|right|center|justify|start|end)$/],
      'text-decoration': [/^(?:none|underline|line-through)(?:\s+(?:underline|line-through))?$/],
    },
  },
  allowedSchemes: ['https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const next: sanitizeHtml.Attributes = { ...attribs, rel: 'noopener noreferrer' };
      if (next.target && next.target !== '_blank') delete next.target;
      return { tagName, attribs: next };
    },
    img: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        alt: /^https?:\/\//.test(attribs.alt ?? '') ? '' : attribs.alt ?? '',
        loading: 'lazy',
        decoding: 'async',
      },
    }),
  },
  exclusiveFilter: (frame) => frame.tag === 'img' && !isSafeArticleImage(frame.attribs.src ?? ''),
};

function isSafeArticleImage(value: string): boolean {
  if (/^\/(?!\/)/.test(value) && !/[\u0000-\u001f\\]/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** DB 纯文本段落 → 参考站的正文段落排版 */
function renderArticleParagraph(paragraph: string): string {
  return `<p>${escapeText(paragraph)}</p>`;
}

function renderArticleSegment(segment: string): string {
  if (!/<\/?[a-z][^>]*>/i.test(segment)) return renderArticleParagraph(segment);
  return sanitizeHtml(segment, ARTICLE_SANITIZE_OPTIONS);
}

/** 详情正文统一渲染入口（复刻页与后台预览共用） */
export function renderArticleBody(segments: string[]): string {
  return segments.map(renderArticleSegment).join('');
}

/* ── 列表卡片 ──────────────────────────────────────────────────────────── */

/** 参考站 .nitem 卡：整个卡片头通过原生链接进入独立详情页。 */
export function renderNewsCard(post: NewsCardSource): string {
  const { day, month } = splitDate(post.published_at);
  const detailHref = `/newsdetail?id=${encodeURIComponent(newsDetailIdOfSlug(post.slug))}`;
  const summary = escapeText(post.summary);
  return (
    `<article class="nitem rv" data-opc-id="${escapeText(newsDetailIdOfSlug(post.slug))}" data-news-cat="${escapeText(post.category)}">`
    + `<a class="nitem__hd" href="${escapeText(detailHref)}">`
    + `<div class="nitem__date"><b>${escapeText(day)}</b><span>${escapeText(month)}</span></div>`
    + `<div class="nitem__ph"><img src="${escapeText(resolveCover(post.cover_url))}" alt="${escapeText(post.title)}" loading="lazy" decoding="async"></div>`
    + `<div class="nitem__bd"><span class="ntag">${escapeText(post.category)}</span>`
    + `<h3>${escapeText(post.title)}</h3>`
    + `<p>${summary}</p></div>`
    + `<span class="nitem__more">${CHEVRON_ICON}</span>`
    + `</a></article>`
  );
}

/* ── DB 加载（默认实现，测试用依赖注入替换） ────────────────────────────── */

/**
 * 读取已发布 news_posts；**未配库 / 查询异常时返回 null**（调用方渲染空列表）。
 *
 * 判定依据：getNewsPosts 在回落分支原样返回 seedNews 的**引用**，
 * 只有 DB 查询成功才会返回新数组。
 */
async function loadPostsFromDb(): Promise<readonly NewsCardSource[] | null> {
  const posts = await getNewsPosts();
  return posts === seedNews ? null : posts;
}

async function loadPostFromDb(slug: string): Promise<NewsArticleSource | null> {
  const post = await getNewsPost(slug);
  if (!post || seedNews.includes(post)) return null;
  return post;
}

export const loadPublishedNewsPosts = loadPostsFromDb;

/* ── 列表页 ────────────────────────────────────────────────────────────── */

export type NewsPostLoader = () => Promise<readonly NewsCardSource[] | null>;
export type NewsPostDetailLoader = (slug: string) => Promise<NewsArticleSource | null>;

export interface ReplicaListOptions {
  loadPosts?: NewsPostLoader;
  loadShell?: (pathname: string) => ReplicaPageContent | null;
}

/**
 * /news 列表渲染：shell 取自烘焙产物，`.newslist` 容器内的静态卡片
 * 整体替换为 DB 卡片；DB 空 → 容器置空（保留容器与外层说明文案）。
 */
export async function getReplicaListPage(
  pathname: string,
  options: ReplicaListOptions = {},
): Promise<ReplicaPageContent | null> {
  if (pathname !== '/news') return null;
  const loadShell = options.loadShell ?? getReplicaPage;
  const shell = loadShell(pathname);
  if (!shell) return null;

  const loadPosts = options.loadPosts ?? loadPostsFromDb;
  let cards = '';
  try {
    const posts = await loadPosts();
    if (posts) cards = posts.map((post) => renderNewsCard(post)).join('');
  } catch (error) {
    console.error('[news-runtime] 读取 news_posts 失败，/news 渲染空列表', error);
  }

  const html = replaceBlockInner(shell.html, 'news-list', 'div', () => cards);
  return { ...shell, html };
}

/* ── 详情页 ────────────────────────────────────────────────────────────── */

export interface ReplicaDetailOptions {
  loadPost?: NewsPostDetailLoader;
}

/**
 * /newsdetail?id= 的运行时解析（DB 唯一事实源）：
 * 1. id 数字 N → 查 DB slug=`opc-N`；id slug 形态 → 查 DB 该 slug
 * 2. DB body 纯文本转义为段落；富文本经允许列表净化后注入 article-shell
 * 3. 未配库 / 查询异常 / 库内无此文 → null（页面 404）
 */
export async function getReplicaDetailPage(
  id: string,
  options: ReplicaDetailOptions = {},
): Promise<ReplicaPageContent | null> {
  if (!NEWSDETAIL_ID_PATTERN.test(id)) return null;
  const slug = /^[1-9]\d{0,9}$/.test(id) ? `${LEGACY_SLUG_PREFIX}${id}` : id;

  const loadPost = options.loadPost ?? loadPostFromDb;
  let post: NewsArticleSource | null = null;
  try {
    post = await loadPost(slug);
  } catch (error) {
    console.error(`[news-runtime] 读取 news_posts(${slug}) 失败，详情 404`, error);
  }

  if (!post) return null;

  const article = renderArticleBody(post.body ?? []);
  const cover = `<figure class="nfig news-detail__cover"><img src="${escapeText(resolveCover(post.cover_url))}" alt="${escapeText(post.title)}" loading="lazy" decoding="async"></figure>`;
  return {
    path: '/newsdetail',
    title: `${post.title} - ${REPLICA_SITE_NAME}`,
    html: articleShell.html
      .replace('__OPC_TITLE__', () => escapeText(post!.title))
      .replace('__OPC_CATEGORY__', () => escapeText(post!.category))
      .replace('__OPC_DATE__', () => escapeText(formatNewsDate(post!.published_at)))
      .replace('__OPC_COVER__', () => cover)
      .replace('__OPC_ARTICLE__', () => article),
  };
}
