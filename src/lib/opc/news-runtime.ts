/** 复刻站新闻/活动列表与详情的运行时渲染层（P1 动态内容）。
 *
 * 契约：docs/14-动态内容契约.md
 * - /newslist、/activitylist：getReplicaPage 取 shell → 替换构建期占位符；
 *   DB（news_posts）查询成功 → 渲染 DB 卡片；未配库/查询异常 → 注入
 *   generated/list-cards.json 的构建期快照兜底串；占位符不存在（旧产物）→
 *   原样返回，保持向后兼容。
 * - /newsdetail：数字 id → DB slug=opc-N → 遗留 generated/details.json；
 *   slug id → DB；都没有 → 404（null）。
 *
 * 本模块服务端专用（依赖 @/lib/queries → supabase admin 客户端）。
 */
import sanitizeHtml from 'sanitize-html';
import { getNewsPosts, getNewsPost } from '@/lib/queries';
import { seedNews } from '@/lib/data/seed';
import {
  REPLICA_SITE_NAME,
  escapeText,
  getReplicaPage,
  type ReplicaPageContent,
} from '@/lib/opc/content';
import {
  channelOfCategory,
  LEGACY_SLUG_PREFIX,
  LIST_PLACEHOLDER,
  NEWSDETAIL_ID_PATTERN,
} from '@/lib/opc/taxonomy';
import articleShell from './generated/article-shell.json' with { type: 'json' };
import listCards from './generated/list-cards.json' with { type: 'json' };

/** 卡片渲染的最小输入面：DB 行与种子行都结构满足（cover_url 仅 DB 行有） */
export interface NewsCardSource {
  slug: string;
  title: string;
  summary: string;
  category: string;
  published_at: string;
  cover_url?: string | null;
}

/** 详情渲染的输入面（比卡片多正文字段） */
export interface NewsArticleSource extends NewsCardSource {
  body: string[];
}

type ListChannel = 'news' | 'activity';

const LIST_CHANNELS: Record<string, ListChannel> = {
  '/newslist': 'news',
  '/activitylist': 'activity',
};

/** cover_url 缺省时的占位图（本地图床，契约第 2 节） */
const FALLBACK_COVER = '/opc/visual/reference-city-blue-960.webp';

/** 契约第 2 节模板的 scoped 属性（照抄烘焙卡，不得改动） */
const NEWS_SCOPE = 'data-v-83dfbbe5=""';
const ACTIVITY_SCOPE = 'data-v-0bb519df=""';

/** news_posts 没有 venue / capacity 列，activity-info 的这两格用快照中性默认值占位
 *  （DOM 结构必须与模板逐属性一致，不能省节点）。 */
const ACTIVITY_VENUE = '集智 AI OPC 社区';
const ACTIVITY_CAPACITY = '50+';

/** DB 纯文本段落沿用遗留烘焙段的排版（article-shell 内联样式口径） */
function renderArticleParagraph(paragraph: string): string {
  return `<p style="line-height:2"><span style="font-size:22px">${escapeText(paragraph)}</span></p>`;
}

const ARTICLE_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote',
    'strong', 'b', 'em', 'i', 'u', 's', 'span', 'div', 'section', 'figure',
    'figcaption', 'img', 'a', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'hr',
  ],
  allowedAttributes: {
    '*': ['style'],
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
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

function renderArticleSegment(segment: string): string {
  if (!/<\/?[a-z][^>]*>/i.test(segment)) return renderArticleParagraph(segment);
  return sanitizeHtml(segment, ARTICLE_SANITIZE_OPTIONS);
}

/**
 * 详情正文统一渲染入口（OPC 复刻页与 /news/[slug] 共用）：
 * 纯文本段 → 遗留烘焙段排版；含 HTML 标签的段（富文本编辑器输出）→ sanitize 后渲染。
 */
export function renderArticleBody(segments: string[]): string {
  return segments.map(renderArticleSegment).join('');
}

/** published_at（ISO 日期或日期时间）→ 卡片/详情用的 YYYY-MM-DD；不合法 → 空串 */
export function formatNewsDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''));
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

/** slug → data-opc-id / sitemap 条目 id：`opc-N` → `N`，其余原样（契约第 2/6 节） */
export function newsDetailIdOfSlug(slug: string): string {
  if (slug.startsWith(LEGACY_SLUG_PREFIX)) {
    const suffix = slug.slice(LEGACY_SLUG_PREFIX.length);
    if (/^[1-9]\d{0,9}$/.test(suffix)) return suffix;
  }
  return slug;
}

/** img src 只接受站内相对路径或 https 绝对地址，其余回落占位图 */
function resolveCover(url: string | null | undefined): string {
  const value = (url ?? '').trim();
  if (value.startsWith('/') || value.startsWith('https://')) return value;
  return FALLBACK_COVER;
}

/* ── 卡片渲染器（输出与契约第 2 节模板逐属性一致） ───────────────────────── */

export function renderNewsCard(post: NewsCardSource): string {
  const id = escapeText(newsDetailIdOfSlug(post.slug));
  return `<div ${NEWS_SCOPE} class="news-item" data-opc-id="${id}" data-opc-action="navigate" data-opc-route="${escapeText(`/newsdetail?id=${newsDetailIdOfSlug(post.slug)}`)}" role="button" tabindex="0" data-opc-category=""><div ${NEWS_SCOPE} class="news-image"><div ${NEWS_SCOPE} class="el-image news-image-img"><img src="${escapeText(resolveCover(post.cover_url))}" class="el-image__inner" style="object-fit:cover" alt="" loading="lazy" decoding="async"></div></div><div ${NEWS_SCOPE} class="news-content"><h3 ${NEWS_SCOPE} class="news-title">${escapeText(post.title)}</h3><p ${NEWS_SCOPE} class="news-summary">${escapeText(post.summary)}</p><div ${NEWS_SCOPE} class="news-meta-bottom"><div ${NEWS_SCOPE} class="news-date">${escapeText(formatNewsDate(post.published_at))}</div><span ${NEWS_SCOPE} class="news-read-more"> 阅读更多 <i ${NEWS_SCOPE} class="fas fa-arrow-right"></i></span></div></div></div>`;
}

export function renderActivityCard(post: NewsCardSource): string {
  const id = escapeText(newsDetailIdOfSlug(post.slug));
  return `<div ${ACTIVITY_SCOPE} class="activity-item" data-opc-id="${id}" data-opc-action="navigate" data-opc-route="${escapeText(`/newsdetail?id=${newsDetailIdOfSlug(post.slug)}`)}" role="button" tabindex="0" data-opc-category="${escapeText(post.category)}"><div ${ACTIVITY_SCOPE} class="activity-image"><div ${ACTIVITY_SCOPE} class="el-image activity-image-img"><img src="${escapeText(resolveCover(post.cover_url))}" class="el-image__inner" style="object-fit:cover" alt="" loading="lazy" decoding="async"></div></div><div ${ACTIVITY_SCOPE} class="activity-content"><span ${ACTIVITY_SCOPE} class="activity-badge">精彩活动</span><h3 ${ACTIVITY_SCOPE} class="activity-title">${escapeText(post.title)}</h3><p ${ACTIVITY_SCOPE} class="activity-description">${escapeText(post.summary)}</p><div ${ACTIVITY_SCOPE} class="activity-info"><div ${ACTIVITY_SCOPE}><i ${ACTIVITY_SCOPE} class="fas fa-calendar"></i> ${escapeText(formatNewsDate(post.published_at))}</div><div ${ACTIVITY_SCOPE}><i ${ACTIVITY_SCOPE} class="fas fa-map-marker-alt"></i> ${escapeText(ACTIVITY_VENUE)}</div><div ${ACTIVITY_SCOPE}><i ${ACTIVITY_SCOPE} class="fas fa-users"></i> ${escapeText(ACTIVITY_CAPACITY)}</div><span ${ACTIVITY_SCOPE} class="activity-read-more"> 查看详情 <i ${ACTIVITY_SCOPE} class="fas fa-arrow-right"></i></span></div></div></div>`;
}

function renderChannelCards(posts: readonly NewsCardSource[], channel: ListChannel): string {
  return posts
    .filter((post) => channelOfCategory(post.category) === channel)
    .map((post) => (channel === 'news' ? renderNewsCard(post) : renderActivityCard(post)))
    .join('');
}

/* ── DB 加载（默认实现，测试用依赖注入替换） ─────────────────────────────── */

/**
 * 读取已发布 news_posts；**未配库 / 查询异常时返回 null**（调用方注入兜底串）。
 *
 * 判定依据：getNewsPosts 在回落分支原样返回 seedNews 的**引用**，
 * 只有 DB 查询成功才会返回新数组（`(data ?? []).map(...)`）。
 * 因此引用相等 ⇔ 未配库或查询异常 —— 这里必须用无参调用
 * （带 category 会 `.filter()` 生成新数组，破坏该判定）。
 */
async function loadPostsFromDb(): Promise<readonly NewsCardSource[] | null> {
  const posts = await getNewsPosts();
  return posts === seedNews ? null : posts;
}

/** sitemap / 列表页共用的 DB 数据入口（未配库/异常 → null → 调用方回落快照） */
export const loadPublishedNewsPosts = loadPostsFromDb;

/**
 * 按 slug 取单篇已发布文章；**未配库 / 查询异常 / 库内无此文 → null**
 * （getNewsPost 回落时返回的是 seedNews 的元素，引用包含判定可识别）。
 */
async function loadPostFromDb(slug: string): Promise<NewsArticleSource | null> {
  const post = await getNewsPost(slug);
  if (!post || seedNews.includes(post)) return null;
  return post;
}

/* ── 列表页：占位符替换（DB 优先、快照兜底） ─────────────────────────────── */

export type NewsPostLoader = () => Promise<readonly NewsCardSource[] | null>;
export type NewsPostDetailLoader = (slug: string) => Promise<NewsArticleSource | null>;

export interface ReplicaListOptions {
  /** DB 加载器（默认连库；测试注入 fixture） */
  loadPosts?: NewsPostLoader;
  /** shell 加载器（默认 getReplicaPage；测试注入带占位符的合成 shell） */
  loadShell?: (pathname: string) => ReplicaPageContent | null;
}

/**
 * 列表页占位符替换核心：占位符不在 shell 中 → 原样返回（旧产物兼容）。
 * 用函数形式替换，避免卡片串里的 `$&`/`$1` 被 String.replace 当作特殊模式。
 */
export function replaceListPlaceholder(html: string, channel: ListChannel, cards: string): string {
  const placeholder = LIST_PLACEHOLDER[channel];
  return html.includes(placeholder) ? html.replace(placeholder, () => cards) : html;
}

/** 兜底串：构建期快照（与改动前烘焙在 pages.json 里的卡片逐字节一致） */
function fallbackCards(channel: ListChannel): string {
  return channel === 'news' ? listCards.news : listCards.activities;
}

/** /newslist、/activitylist 的运行时渲染入口（服务端 async） */
export async function getReplicaListPage(
  pathname: string,
  options: ReplicaListOptions = {},
): Promise<ReplicaPageContent | null> {
  const channel = LIST_CHANNELS[pathname];
  if (!channel) return null;
  const loadShell = options.loadShell ?? getReplicaPage;
  const shell = loadShell(pathname);
  if (!shell) return null;
  const placeholder = LIST_PLACEHOLDER[channel];
  if (!shell.html.includes(placeholder)) return shell; // 旧 pages.json：无占位符，原样返回

  const loadPosts = options.loadPosts ?? loadPostsFromDb;
  let cards: string;
  try {
    const posts = await loadPosts();
    cards = posts ? renderChannelCards(posts, channel) : fallbackCards(channel);
  } catch (error) {
    console.error(`[news-runtime] 读取 news_posts 失败，/${channel === 'news' ? 'newslist' : 'activitylist'} 注入快照兜底串`, error);
    cards = fallbackCards(channel);
  }
  return { ...shell, html: replaceListPlaceholder(shell.html, channel, cards) };
}

/* ── 详情页：双源解析（契约第 4 节） ─────────────────────────────────────── */

export interface ReplicaDetailOptions {
  /** DB 加载器（默认连库；测试注入 fixture） */
  loadPost?: NewsPostDetailLoader;
}

/**
 * /newsdetail?id= 的运行时解析：
 * 1. id 数字 N → 先查 DB slug=`opc-N`，再回落遗留 generated/details.json[N]
 * 2. id slug 形态 → 查 DB 该 slug（无遗留回落）
 * 3. DB body 纯文本转义为 `<p>`；富文本经允许列表净化后直接注入 article-shell
 * 4. 都没有 → null（页面 404）
 * 查询失败（异常）同样回落 details.json。
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
    console.error(`[news-runtime] 读取 news_posts(${slug}) 失败，回落遗留详情快照`, error);
  }

  const resolved = post;
  if (resolved) {
    const article = resolved.body.map(renderArticleSegment).join('');
    return {
      path: '/newsdetail',
      title: `${resolved.title} - ${REPLICA_SITE_NAME}`,
      html: articleShell.html
        .replace('__OPC_TITLE__', () => escapeText(resolved.title))
        .replace('__OPC_DATE__', () => escapeText(formatNewsDate(resolved.published_at)))
        .replace('__OPC_ARTICLE__', () => article),
    };
  }
  // 遗留兜底：details.json（内部再做 id 校验与存在性检查，查不到 → null）
  return getReplicaPage('/newsdetail', { id });
}
