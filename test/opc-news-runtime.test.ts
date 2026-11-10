/**
 * 社区动态运行时渲染层（src/lib/opc/news-runtime.ts）的契约测试。
 *
 * ── 2026-11-10 全站复刻后的契约 ─────────────────────────────────────────
 *   - /news：单一列表通道（旧的 /newslist + /activitylist 双通道已下线），
 *     列表容器由编译期打的 `data-opc-block="news-list"` 标记定位；
 *   - 卡片形态对齐参考站 .nitem（日期拆成「日 + 年月」、类目 tag，
 *     整个卡片头链接到 /newsdetail?id=<slug>，不输出折叠正文）；
 *   - /newsdetail?id=：数字 id → slug=opc-N；slug → 原样；
 *     DB 未命中 / 查询异常 / 非法 id → 404（null）；
 *   - 纯文本正文转义成段落；富文本经 sanitize-html 允许列表净化。
 *
 * 全部用 fixture + 依赖注入，**不连库、不依赖构建管线再生成**：
 * DB 加载器通过 options.loadPosts / options.loadPost 注入。
 *
 * 删除的旧断言（逐条说明）：
 *   - 「news-item 卡与烘焙卡逐字节对拍」→ 卡结构换成参考站 .nitem，
 *     且列表不再烘焙卡（DB 唯一事实源），没有可比对的烘焙物；
 *   - 「renderActivityCard 活动卡模板」→ 活动通道已下线，API 已删除；
 *   - 「replaceListPlaceholder / LIST_PLACEHOLDER 占位符替换」
 *     → news 列表改用 data-opc-block 标记，占位符机制整体下线；
 *   - 「getReplicaPage('/newsdetail', {id}) / getReplicaArticle」
 *     → content.ts 已删除这两个 API（详情改由 news-runtime 异步解析）；
 *   - 「scripts/opc-source/public-content.json 的 371 号长文快照」
 *     → 旧站快照数据源已随旧站下线。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { ReplicaPageContent } from '@/lib/opc/content';
import {
  formatNewsDate,
  getReplicaDetailPage,
  getReplicaListPage,
  newsDetailIdOfSlug,
  renderArticleBody,
  renderNewsCard,
  type NewsArticleSource,
  type NewsCardSource,
} from '@/lib/opc/news-runtime';

const articleShell = JSON.parse(readFileSync('src/lib/opc/generated/article-shell.json', 'utf8')) as {
  html: string;
};

const newsPost: NewsCardSource = {
  slug: 'opc-392',
  title: '集智 AI OPC 女性赋能计划第三期圆满收官',
  summary: '数字技术浪潮汹涌，AI 工具正在重塑商业底层逻辑。',
  category: '行业观察',
  published_at: '2026-10-22',
  cover_url: '/opc/reference/img/news-wuzhen-opc.jpg',
};

describe('卡片渲染器 · renderNewsCard（整卡跳转详情）', () => {
  test('日期、类目与标题保留，整个卡片头都是详情链接', () => {
    const html = renderNewsCard(newsPost);
    assert.ok(html.includes('<div class="nitem__date"><b>22</b><span>2026-10</span></div>'));
    assert.ok(html.includes('<span class="ntag">行业观察</span>'));
    assert.ok(html.includes('<a class="nitem__hd" href="/newsdetail?id=392">'));
    assert.ok(html.includes('<h3>集智 AI OPC 女性赋能计划第三期圆满收官</h3>'));
    assert.ok(!html.includes('<h3><a'), '标题内不得再嵌套链接');
    assert.ok(html.includes('class="nitem rv"'));
    assert.ok(html.includes('data-news-cat="行业观察"'));
    assert.ok(html.includes('data-opc-id="392"'));
  });

  test('列表不输出折叠正文，每张卡只有一个详情跳转入口', () => {
    const html = renderNewsCard({ ...newsPost, body: ['第一段正文', '第二段正文'] });
    assert.ok(!html.includes('nitem__body'));
    assert.ok(!html.includes('阅读全文'));
    assert.equal((html.match(/<a class="nitem__hd"/g) ?? []).length, 1);
  });

  test('slug 形态的 id 原样透出（不是 opc-N 时不转数字）', () => {
    const html = renderNewsCard({ ...newsPost, slug: 'salon-2026-10' });
    assert.ok(html.includes('data-opc-id="salon-2026-10"'));
    assert.ok(html.includes('href="/newsdetail?id=salon-2026-10"'));
  });

  test('全部文本插值经 HTML 转义（标题 / 摘要 / 类目 / slug）', () => {
    const hostile: NewsCardSource = {
      slug: 'opc-<b>&"',
      title: '<script>alert(1)</script> & "引号" \'单引号\'',
      summary: '<img src=x onerror=alert(2)>',
      category: '<活动>',
      published_at: '2026-01-02',
    };
    const html = renderNewsCard(hostile);
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;引号&quot; &#39;单引号&#39;'));
    assert.ok(html.includes('&lt;img src=x onerror=alert(2)&gt;'));
    assert.ok(!html.includes('<script'), '不得出现真实 script 标签');
    // 事件属性只允许出现在标签内部；转义后的文本不算
    assert.doesNotMatch(html, /<[a-zA-Z][^>]*\son[a-z]+\s*=/i);
    assert.ok(html.includes('data-opc-id="opc-&lt;b&gt;&amp;&quot;"'));
    assert.ok(html.includes('data-news-cat="&lt;活动&gt;"'));
  });

  test('cover_url 缺省 / 非法回落站内占位图，https 与站内相对路径放行', () => {
    const base = { ...newsPost };
    assert.ok(renderNewsCard({ ...base, cover_url: undefined }).includes('src="/opc/reference/img/news-wuzhen-opc.jpg"'));
    assert.ok(renderNewsCard({ ...base, cover_url: '' }).includes('src="/opc/reference/img/news-wuzhen-opc.jpg"'));
    assert.ok(renderNewsCard({ ...base, cover_url: 'javascript:alert(1)' }).includes('src="/opc/reference/img/news-wuzhen-opc.jpg"'));
    assert.ok(renderNewsCard({ ...base, cover_url: 'http://insecure.example/x.jpg' }).includes('src="/opc/reference/img/news-wuzhen-opc.jpg"'));
    assert.ok(renderNewsCard({ ...base, cover_url: 'https://cdn.example.com/x.jpg' }).includes('src="https://cdn.example.com/x.jpg"'));
    assert.ok(renderNewsCard({ ...base, cover_url: '/opc/reference/img/hero-banner-1.jpg' }).includes('src="/opc/reference/img/hero-banner-1.jpg"'));
  });

  test('卡片是可直接作为列表容器子节点的单根元素', () => {
    const fragment = renderNewsCard(newsPost) + renderNewsCard(newsPost);
    assert.equal((fragment.match(/<article class="nitem rv"/g) ?? []).length, 2);
    assert.equal((fragment.match(/<\/article>/g) ?? []).length, 2);
  });
});

describe('字段映射工具', () => {
  test('newsDetailIdOfSlug：opc-N → N，非数字后缀与其余 slug 原样', () => {
    assert.equal(newsDetailIdOfSlug('opc-392'), '392');
    assert.equal(newsDetailIdOfSlug('opc-0'), 'opc-0'); // 0 不是合法数字 id
    assert.equal(newsDetailIdOfSlug('opc-salon-2026-10'), 'opc-salon-2026-10');
    assert.equal(newsDetailIdOfSlug('my-post'), 'my-post');
  });

  test('formatNewsDate：ISO 日期时间截断为 YYYY-MM-DD，非法输入为空串', () => {
    assert.equal(formatNewsDate('2026-03-12T08:00:00.000Z'), '2026-03-12');
    assert.equal(formatNewsDate('2026-03-12'), '2026-03-12');
    assert.equal(formatNewsDate('不是日期'), '');
    assert.equal(formatNewsDate(''), '');
  });
});

describe('getReplicaListPage：/news 列表渲染', () => {
  const shellOf = (path: string, html: string): ReplicaPageContent => ({ path, title: `标题${path}`, html });

  test('注入的 fixture 渲染成 .nitem 卡（日期 / 类目 / 标题链接齐备）', async () => {
    const page = await getReplicaListPage('/news', {
      loadShell: () => shellOf('/news', '<div class="newslist" data-opc-block="news-list">OLD</div>'),
      loadPosts: async () => [newsPost],
    });
    assert.ok(page);
    assert.ok(page!.html.includes('class="newslist"'), '容器必须在');
    assert.ok(page!.html.includes('data-opc-block="news-list"'), '容器标记必须在');
    assert.ok(page!.html.includes('<div class="nitem__date"><b>22</b><span>2026-10</span></div>'));
    assert.ok(page!.html.includes('<span class="ntag">行业观察</span>'));
    assert.ok(page!.html.includes('<a class="nitem__hd" href="/newsdetail?id=392">'));
    assert.ok(page!.html.includes('<h3>集智 AI OPC 女性赋能计划第三期圆满收官</h3>'));
    assert.ok(!page!.html.includes('OLD'), '旧内容必须被替换掉');
  });

  test('DB 返回 null（未配库）→ 空列表（容器保留，不回落快照）', async () => {
    const page = await getReplicaListPage('/news', {
      loadShell: () => shellOf('/news', '<div class="newslist" data-opc-block="news-list">SNAPSHOT</div>'),
      loadPosts: async () => null,
    });
    assert.ok(page!.html.includes('class="newslist"'), '列表容器必须在');
    assert.ok(!page!.html.includes('SNAPSHOT'), '快照内容不得注入');
    assert.ok(!page!.html.includes('class="nitem rv"'));
  });

  test('loader 抛异常 → 同样空列表（不 500）', async () => {
    const page = await getReplicaListPage('/news', {
      loadShell: () => shellOf('/news', '<div class="newslist" data-opc-block="news-list">SNAPSHOT</div>'),
      loadPosts: async () => {
        throw new Error('db down');
      },
    });
    assert.ok(page, '异常不得让页面 500');
    assert.ok(!page!.html.includes('SNAPSHOT'));
    assert.ok(!page!.html.includes('class="nitem rv"'));
  });

  test('DB 查询成功但为空 → 空列表', async () => {
    const page = await getReplicaListPage('/news', {
      loadShell: () => shellOf('/news', '<div class="newslist" data-opc-block="news-list">X</div>'),
      loadPosts: async () => [],
    });
    assert.ok(page!.html.includes('class="newslist"'));
    assert.ok(!page!.html.includes('class="nitem rv"'));
  });

  test('真实 shell（烘焙产物）可解析，容器被替换且保留外层说明文案', async () => {
    const page = await getReplicaListPage('/news', { loadPosts: async () => [newsPost] });
    assert.ok(page);
    assert.ok(page!.html.length > 1000);
    assert.ok(page!.html.includes('class="newslist"'));
    assert.ok(page!.html.includes('class="nitem rv"'));
  });

  test('非列表路径 → null', async () => {
    assert.equal(await getReplicaListPage('/about'), null);
    assert.equal(await getReplicaListPage('/newsdetail'), null);
  });
});

describe('getReplicaDetailPage：DB 唯一事实源', () => {
  const dbPost: NewsArticleSource = {
    slug: 'opc-392',
    title: 'DB 里的新文章',
    summary: '摘要',
    category: '行业观察',
    published_at: '2026-10-23T10:00:00Z',
    cover_url: null,
    body: ['第一段<b>加粗</b>', '第二段&引号"'],
  };

  test('数字 id：查 DB slug=opc-N，正文注入文章外壳', async () => {
    const slugs: string[] = [];
    const page = await getReplicaDetailPage('392', {
      loadPost: async (slug) => {
        slugs.push(slug);
        return dbPost;
      },
    });
    assert.deepEqual(slugs, ['opc-392']);
    assert.equal(page!.title, 'DB 里的新文章 - 集智 AI OPC 社区');
    assert.equal(page!.path, '/newsdetail');
    assert.ok(page!.html.includes('>DB 里的新文章</h1>'));
    assert.ok(page!.html.includes('2026-10-23'));
    assert.ok(page!.html.includes('第一段<b>加粗</b>'));
    assert.doesNotMatch(page!.html, /__OPC_(?:TITLE|DATE|COVER|ARTICLE)__/);
    // 封面渲染：cover_url 为 null → 回落站内占位图，与列表卡同策略
    assert.ok(page!.html.includes('class="nfig news-detail__cover"'));
    assert.ok(page!.html.includes('src="/opc/reference/img/news-wuzhen-opc.jpg"'));
    // alt 用转义后的标题
    assert.ok(page!.html.includes('alt="DB 里的新文章"'));
  });

  test('详情页封面：DB cover_url 直接渲染，非法值回落占位图', async () => {
    const hit = await getReplicaDetailPage('392', {
      loadPost: async () => ({ ...dbPost, cover_url: 'https://cdn.example.com/cover.jpg' }),
    });
    assert.ok(hit!.html.includes('src="https://cdn.example.com/cover.jpg"'));
    const bad = await getReplicaDetailPage('392', {
      loadPost: async () => ({ ...dbPost, cover_url: 'javascript:alert(1)' }),
    });
    assert.ok(bad!.html.includes('src="/opc/reference/img/news-wuzhen-opc.jpg"'));
  });

  test('slug id：只查 DB（loader 收到原样 slug）', async () => {
    const slugs: string[] = [];
    const hit = await getReplicaDetailPage('my-new-post', {
      loadPost: async (slug) => {
        slugs.push(slug);
        return { ...dbPost, slug };
      },
    });
    assert.deepEqual(slugs, ['my-new-post']);
    assert.equal(hit!.title, 'DB 里的新文章 - 集智 AI OPC 社区');
  });

  test('库里没有 → null（404），不回落任何快照', async () => {
    assert.equal(await getReplicaDetailPage('392', { loadPost: async () => null }), null);
    assert.equal(await getReplicaDetailPage('my-new-post', { loadPost: async () => null }), null);
  });

  test('查询异常 → 同样 404（不 500）', async () => {
    const page = await getReplicaDetailPage('392', {
      loadPost: async () => {
        throw new Error('db down');
      },
    });
    assert.equal(page, null);
  });

  test('非法 id：直接 404，不触发 DB 查询', async () => {
    let loaded = false;
    const loader = async () => {
      loaded = true;
      return dbPost;
    };
    for (const id of ['../392', '392/../1', '__proto__', '-1', 'ABC', 'UPPER', '', 'a'.repeat(81)]) {
      assert.equal(await getReplicaDetailPage(id, { loadPost: loader }), null, id);
    }
    assert.equal(loaded, false);
  });

  test('数字 0 不是合法数字 id，但作为 slug 形态按原样查库', async () => {
    const slugs: string[] = [];
    const page = await getReplicaDetailPage('0', {
      loadPost: async (slug) => {
        slugs.push(slug);
        return { ...dbPost, slug };
      },
    });
    assert.deepEqual(slugs, ['0'], '0 走 slug 通道，不做 opc- 前缀转换');
    assert.ok(page);
  });

  test('纯文本 body 转义成段落', async () => {
    const page = await getReplicaDetailPage('392', {
      loadPost: async () => ({ ...dbPost, body: ['普通段落 & 引号"', '第二段'] }),
    });
    assert.ok(page);
    assert.ok(page!.html.includes('<p>普通段落 &amp; 引号&quot;</p>'));
    assert.ok(page!.html.includes('<p>第二段</p>'));
  });

  test('含标签的段落经净化：script 标签连同内容剔除，事件属性剥离', async () => {
    const page = await getReplicaDetailPage('392', {
      loadPost: async () => ({ ...dbPost, body: ['<script>alert(1)</script>', '<p onclick="alert(2)">段落</p>'] }),
    });
    assert.ok(page);
    assert.ok(!page!.html.includes('<script'), '不得出现真实 script 标签');
    assert.ok(!page!.html.includes('alert(1)'), 'script 内容一并剔除（不落 DOM）');
    assert.doesNotMatch(page!.html, /<[a-zA-Z][^>]*\son[a-z]+\s*=/i);
    assert.ok(page!.html.includes('<p>段落</p>'), '事件属性被剥离，标签保留');
  });

  test('富文本经允许列表净化：保留安全标签，剔除 script / 事件属性 / javascript:', async () => {
    const page = await getReplicaDetailPage('392', {
      loadPost: async () => ({
        ...dbPost,
        body: [
          '<p>安全<strong>加粗</strong><a href="https://example.com" target="_blank">链接</a>'
            + '<a href="javascript:alert(1)">危险链接</a>'
            + '<img src="https://example.com/a.jpg" onerror="alert(1)">'
            + '<img src="javascript:alert(2)"><script>alert(3)</script>'
            + '<iframe src="https://example.com"></iframe></p>',
        ],
      }),
    });
    assert.ok(page);
    assert.ok(page!.html.includes('<strong>加粗</strong>'));
    assert.ok(page!.html.includes('href="https://example.com"'));
    assert.ok(page!.html.includes('rel="noopener noreferrer"'));
    assert.ok(page!.html.includes('src="https://example.com/a.jpg"'));
    assert.doesNotMatch(page!.html, /<script\b|<iframe\b|\son\w+\s*=|javascript:/i);
  });

  test('标题与日期也经过转义', async () => {
    const page = await getReplicaDetailPage('392', {
      loadPost: async () => ({ ...dbPost, title: '<script>alert(1)</script>' }),
    });
    assert.ok(page);
    assert.ok(!page!.html.includes('<script>alert(1)</script>'));
    assert.ok(page!.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  });

  test('文章外壳的三个占位符都被替换掉', async () => {
    const page = await getReplicaDetailPage('392', { loadPost: async () => dbPost });
    assert.ok(page);
    for (const token of ['__OPC_TITLE__', '__OPC_CATEGORY__', '__OPC_DATE__', '__OPC_ARTICLE__']) {
      assert.ok(!page!.html.includes(token), token);
    }
    // 详情使用独立文章结构，不继承列表的折叠隐藏或摘要截断样式
    assert.ok(page!.html.includes('class="news-detail"'));
    assert.ok(page!.html.includes('class="news-detail__body"'));
    assert.ok(!page!.html.includes('nitem__body'));
  });
});

describe('renderArticleBody：正文渲染入口', () => {
  test('纯文本逐段转义成 <p>', () => {
    const html = renderArticleBody(['第一段', '第二段']);
    assert.equal(html, '<p>第一段</p><p>第二段</p>');
  });

  test('富文本段经净化后保留允许的标签', () => {
    const html = renderArticleBody(['<p>有<b>标签</b></p>']);
    assert.ok(html.includes('<b>标签</b>'));
    assert.doesNotMatch(html, /<script\b|\son\w+\s*=/i);
  });

  test('空数组 → 空串', () => {
    assert.equal(renderArticleBody([]), '');
  });
});

describe('文章外壳产物本身', () => {
  test('外壳只保留占位符，不含脚本与事件属性', () => {
    assert.doesNotMatch(articleShell.html, /<script\b|\son[a-z]+\s*=/i);
    assert.ok(articleShell.html.includes('__OPC_TITLE__'));
    assert.ok(articleShell.html.includes('__OPC_CATEGORY__'));
    assert.ok(articleShell.html.includes('__OPC_DATE__'));
    assert.ok(articleShell.html.includes('__OPC_ARTICLE__'));
  });
});
