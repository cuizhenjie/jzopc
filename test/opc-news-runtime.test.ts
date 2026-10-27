/**
 * 运行时渲染层（src/lib/opc/news-runtime.ts）的契约测试。
 * 契约：docs/14-动态内容契约.md
 *
 * 全部用 fixture + 依赖注入，**不连库、不依赖构建管线再生成**：
 * DB 加载器通过 options.loadPosts / options.loadPost 注入。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getReplicaPage, getReplicaArticle } from '@/lib/opc/content';
import type { ReplicaPageContent } from '@/lib/opc/content';
import { LIST_PLACEHOLDER } from '@/lib/opc/taxonomy';
import {
  formatNewsDate,
  getReplicaDetailPage,
  getReplicaListPage,
  newsDetailIdOfSlug,
  renderActivityCard,
  renderNewsCard,
  replaceListPlaceholder,
  type NewsArticleSource,
  type NewsCardSource,
} from '@/lib/opc/news-runtime';

const listCards = JSON.parse(readFileSync('src/lib/opc/generated/list-cards.json', 'utf8')) as {
  news: string;
  activities: string;
};

/** 与改动前烘焙在 pages.json 里的第一张 news-item 卡（id=392）逐字节对拍 */
const bakedNewsCard392 =
  '<div data-v-83dfbbe5="" class="news-item"' + listCards.news.split('<div data-v-83dfbbe5="" class="news-item"')[1];

const post392: NewsCardSource = {
  slug: 'opc-392',
  title: '巾帼逐梦正当时，集智 AI OPC女性赋能计划第三期圆满收官！',
  summary:
    '数字技术浪潮汹涌，AI工具正在重塑商业底层逻辑。继8月二期AIGC微视频实训后，10月17日下午，由鼓楼区妇联、鼓楼高新区妇联主办，集智 AI OPC 社区承办的“集智 AI OPC 社区+女性赋能计划”第三期路演活动，在鼓楼集智 AI OPC 社区圆满举办。',
  category: '资讯',
  published_at: '2026-10-22',
  cover_url: '/opc/assets/ebe827906d3808f9.webp',
};

describe('卡片渲染器：与契约第 2 节模板逐属性对拍', () => {
  test('news-item 输出与烘焙卡 id=392 逐字节一致', () => {
    assert.equal(renderNewsCard(post392), bakedNewsCard392);
  });

  test('activity-item 输出与模板串逐属性一致（类名/scoped 属性/徽标/信息格）', () => {
    const post: NewsCardSource = {
      slug: 'opc-197',
      title: '活动标题X',
      summary: '活动简介Y',
      category: '活动',
      published_at: '2026-08-04T09:30:00+08:00',
      cover_url: null,
    };
    assert.equal(
      renderActivityCard(post),
      '<div data-v-0bb519df="" class="activity-item" data-opc-id="197" data-opc-action="navigate" data-opc-route="/newsdetail?id=197" role="button" tabindex="0" data-opc-category="活动">'
        + '<div data-v-0bb519df="" class="activity-image"><div data-v-0bb519df="" class="el-image activity-image-img"><img src="/opc/visual/reference-city-blue-960.webp" class="el-image__inner" style="object-fit:cover" alt="" loading="lazy" decoding="async"></div></div>'
        + '<div data-v-0bb519df="" class="activity-content"><span data-v-0bb519df="" class="activity-badge">精彩活动</span><h3 data-v-0bb519df="" class="activity-title">活动标题X</h3><p data-v-0bb519df="" class="activity-description">活动简介Y</p>'
        + '<div data-v-0bb519df="" class="activity-info"><div data-v-0bb519df=""><i data-v-0bb519df="" class="fas fa-calendar"></i> 2026-08-04</div><div data-v-0bb519df=""><i data-v-0bb519df="" class="fas fa-map-marker-alt"></i> 集智 AI OPC 社区</div><div data-v-0bb519df=""><i data-v-0bb519df="" class="fas fa-users"></i> 50+</div><span data-v-0bb519df="" class="activity-read-more"> 查看详情 <i data-v-0bb519df="" class="fas fa-arrow-right"></i></span></div></div></div>',
    );
  });

  test('全部文本插值经 HTML 转义（标题/摘要/类目/日期/slug）', () => {
    const hostile: NewsCardSource = {
      slug: 'opc-<b>&"',
      title: '<script>alert(1)</script> & "引号" \'单引号\'',
      summary: '<img src=x onerror=alert(2)>',
      category: '<活动>',
      published_at: '2026-01-02',
    };
    const news = renderNewsCard(hostile);
    const activity = renderActivityCard(hostile);
    for (const html of [news, activity]) {
      assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;引号&quot; &#39;单引号&#39;'));
      assert.ok(html.includes('&lt;img src=x onerror=alert(2)&gt;'));
      assert.doesNotMatch(html, /<script\b|\son\w+=\(/);
    }
    assert.ok(activity.includes('data-opc-category="&lt;活动&gt;"'));
    // slug 里的特殊字符同样转义（属性值安全）
    assert.ok(news.includes('data-opc-id="opc-&lt;b&gt;&amp;&quot;"'));
    assert.ok(news.includes('data-opc-route="/newsdetail?id=opc-&lt;b&gt;&amp;&quot;"'));
  });

  test('cover_url 缺省/非法回落占位图，https 与站内相对路径放行', () => {
    const base = { ...post392 };
    assert.ok(renderNewsCard({ ...base, cover_url: undefined }).includes('src="/opc/visual/reference-city-blue-960.webp"'));
    assert.ok(renderNewsCard({ ...base, cover_url: '' }).includes('src="/opc/visual/reference-city-blue-960.webp"'));
    assert.ok(renderNewsCard({ ...base, cover_url: 'javascript:alert(1)' }).includes('src="/opc/visual/reference-city-blue-960.webp"'));
    assert.ok(renderNewsCard({ ...base, cover_url: 'http://insecure.example/x.webp' }).includes('src="/opc/visual/reference-city-blue-960.webp"'));
    assert.ok(renderNewsCard({ ...base, cover_url: 'https://cdn.example.com/x.webp' }).includes('src="https://cdn.example.com/x.webp"'));
    assert.ok(renderNewsCard({ ...base, cover_url: '/opc/assets/other.webp' }).includes('src="/opc/assets/other.webp"'));
  });

  test('卡片是可直接作为 .news-list/.activity-list 子节点的单根元素', () => {
    // 容器直接子节点必须是完整卡（ReplicaInteractions 的筛选/加载更多依赖）
    const fragment = renderNewsCard(post392) + renderNewsCard(post392);
    assert.equal(fragment.split('<div data-v-83dfbbe5="" class="news-item"').length - 1, 2);
    assert.equal((fragment.match(/<\/div>/g) ?? []).length, (fragment.match(/<div\b/g) ?? []).length);
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

describe('getReplicaListPage：占位符注入', () => {
  const shellOf = (path: string, html: string): ReplicaPageContent => ({ path, title: `标题${path}`, html });
  const shellWithPlaceholder = (path: string): ReplicaPageContent =>
    shellOf(path, `<div class="${path === '/newslist' ? 'news-list' : 'activity-list'}">${path === '/newslist' ? LIST_PLACEHOLDER.news : LIST_PLACEHOLDER.activity}</div>`);

  const newsPost: NewsCardSource = { slug: 'opc-1', title: '资讯甲', summary: '甲摘要', category: '资讯', published_at: '2026-02-01' };
  const salonPost: NewsCardSource = { slug: 'salon-x', title: '沙龙乙', summary: '乙摘要', category: '沙龙', published_at: '2026-02-02' };
  const activityPost: NewsCardSource = { slug: 'opc-3', title: '活动丙', summary: '丙摘要', category: '活动', published_at: '2026-02-03' };

  test('按 channelOfCategory 分流：newslist 只收 资讯/沙龙，activitylist 只收 活动', async () => {
    const loadPosts = async () => [activityPost, newsPost, salonPost];
    const news = await getReplicaListPage('/newslist', { loadShell: shellWithPlaceholder, loadPosts });
    const activity = await getReplicaListPage('/activitylist', { loadShell: shellWithPlaceholder, loadPosts });
    assert.ok(news!.html.includes('资讯甲'));
    assert.ok(news!.html.includes('沙龙乙'));
    assert.ok(!news!.html.includes('活动丙'));
    assert.ok(activity!.html.includes('活动丙'));
    assert.ok(!activity!.html.includes('资讯甲'));
    assert.ok(!activity!.html.includes('沙龙乙'));
    // 未分流到任何列表页的类目（如未知类目）不渲染
    const unknown = await getReplicaListPage('/newslist', {
      loadShell: shellWithPlaceholder,
      loadPosts: async () => [{ ...newsPost, category: '未知类目' }],
    });
    assert.ok(!unknown!.html.includes('class="news-item"'));
  });

  test('DB 查询成功但为空 → 渲染空卡片串（下架即不可见，不回落快照）', async () => {
    const page = await getReplicaListPage('/newslist', { loadShell: shellWithPlaceholder, loadPosts: async () => [] });
    assert.ok(page!.html.includes('class="news-list"'));
    assert.ok(!page!.html.includes('class="news-item"'));
  });

  test('未配库（loader 返回 null）→ 空列表（DB 唯一事实源，不回落快照）', async () => {
    const news = await getReplicaListPage('/newslist', { loadShell: shellWithPlaceholder, loadPosts: async () => null });
    const activity = await getReplicaListPage('/activitylist', { loadShell: shellWithPlaceholder, loadPosts: async () => null });
    assert.ok(news!.html.includes('class="news-list"'), '列表容器必须在');
    assert.ok(!news!.html.includes('class="news-item"'), '烘焙卡不得注入');
    assert.ok(!activity!.html.includes('class="activity-item"'));
    assert.ok(!activity!.html.includes('精彩活动'));
  });

  test('loader 抛异常 → 同样空列表', async () => {
    const page = await getReplicaListPage('/newslist', {
      loadShell: shellWithPlaceholder,
      loadPosts: async () => {
        throw new Error('db down');
      },
    });
    assert.ok(!page!.html.includes('class="news-item"'), '异常不得注入烘焙卡');
  });

  test('卡片串含 $&/$1 等 replace 特殊串时按字面注入', async () => {
    const dollar: NewsCardSource = { ...newsPost, title: '价格$&优惠$1' };
    const page = await getReplicaListPage('/newslist', { loadShell: shellWithPlaceholder, loadPosts: async () => [dollar] });
    assert.ok(page!.html.includes('价格$&amp;优惠$1'));
  });

  test('占位符不在 shell 中（旧版 pages.json 产物）→ 原样返回且不触发 DB 加载', async () => {
    let loaded = false;
    // pages.json 由构建管线并行演进（当前已带占位符），兼容分支用无占位符的合成 shell 锁行为
    const legacyHtml = '<div data-v-83dfbbe5="" class="news-list"><div data-v-83dfbbe5="" class="news-item" data-opc-id="392"></div></div>';
    const page = await getReplicaListPage('/newslist', {
      loadShell: () => shellOf('/newslist', legacyHtml),
      loadPosts: async () => {
        loaded = true;
        return [newsPost];
      },
    });
    assert.equal(page!.html, legacyHtml);
    assert.equal(loaded, false);
  });

  test('当前真实 shell（pages.json 占位符状态由构建管线决定）可解析且只替换占位符区间', async () => {
    // 真实 shell 无论是否带占位符都必须可解析：带 → 注入后不含占位符；不带 → 原样
    const page = await getReplicaListPage('/newslist', { loadPosts: async () => [newsPost] });
    assert.ok(page);
    assert.ok(page.html.length > 1000);
    assert.ok(!page.html.includes(LIST_PLACEHOLDER.news));
    assert.ok(!page.html.includes(LIST_PLACEHOLDER.activity));
    // 页头/页脚等 shell 结构保留
    assert.ok(page.html.includes('class="newslist"'));
  });

  test('replaceListPlaceholder：无占位符原样返回；shell 的标题与路径字段保持', async () => {
    assert.equal(replaceListPlaceholder('<div>无占位符</div>', 'news', '<card/>'), '<div>无占位符</div>');
    const page = await getReplicaListPage('/newslist', { loadShell: shellWithPlaceholder, loadPosts: async () => [newsPost] });
    assert.equal(page!.title, '标题/newslist');
    assert.equal(page!.path, '/newslist');
  });

  test('非列表路径 → null', async () => {
    assert.equal(await getReplicaListPage('/about'), null);
    assert.equal(await getReplicaListPage('/newsdetail'), null);
  });
});

describe('getReplicaDetailPage：双源解析顺序（契约第 4 节）', () => {
  const dbPost: NewsArticleSource = {
    slug: 'opc-392',
    title: 'DB 里的新文章',
    summary: '摘要',
    category: '资讯',
    published_at: '2026-10-23T10:00:00Z',
    cover_url: null,
    body: ['第一段<b>加粗</b>', '第二段&引号"'],
  };

  test('数字 id：先查 DB slug=opc-N，富文本保留标签而纯文本仍逐段转义', async () => {
    const slugs: string[] = [];
    const page = await getReplicaDetailPage('392', {
      loadPost: async (slug) => {
        slugs.push(slug);
        return dbPost;
      },
    });
    assert.deepEqual(slugs, ['opc-392']);
    assert.equal(page!.title, 'DB 里的新文章 - 集智 AI OPC 社区');
    assert.ok(page!.html.includes('class="article-title">DB 里的新文章</h1>'));
    assert.ok(page!.html.includes('2026-10-23'));
    assert.ok(page!.html.includes('第一段<b>加粗</b>'));
    assert.ok(page!.html.includes('<p style="line-height:2"><span style="font-size:22px">第二段&amp;引号&quot;</span></p>'));
    assert.doesNotMatch(page!.html, /__OPC_(?:TITLE|DATE|ARTICLE)__/);
    assert.ok(!page!.html.includes('第一段&lt;b&gt;'));
  });

  test('id=371：迁移后的完整富文本直接渲染段落与正文图片', async () => {
    const snapshot = JSON.parse(readFileSync('scripts/opc-source/public-content.json', 'utf8')) as {
      records: Record<string, { content: { sort: number; content: string }[] }>;
    };
    const body = snapshot.records['371'].content
      .filter((item) => item.sort !== -1)
      .sort((a, b) => a.sort - b.sort)
      .map((item) => item.content);
    const page = await getReplicaDetailPage('371', {
      loadPost: async () => ({ ...dbPost, slug: 'opc-371', body }),
    });
    assert.ok(page);
    assert.ok(!page.html.includes('&lt;p'));
    assert.ok(!page.html.includes('&lt;img'));
    assert.equal((page.html.match(/<img\b/g) ?? []).length, 5);
    assert.ok(page.html.includes('src="https://www.opcstore.com/opc/20261009/e11b3d94e2476cbbf57cb8157c9ad4b3.jpg"'));
    assert.ok(page.html.includes('人工智能AIGC技术正以前所未有的速度'));
  });

  test('富文本净化：保留安全格式，移除脚本、事件属性与危险协议', async () => {
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
    assert.ok(page.html.includes('<strong>加粗</strong>'));
    assert.ok(page.html.includes('href="https://example.com"'));
    assert.ok(page.html.includes('rel="noopener noreferrer"'));
    assert.ok(page.html.includes('src="https://example.com/a.jpg"'));
    assert.doesNotMatch(page.html, /<script\b|<iframe\b|\son\w+\s*=|javascript:/i);
  });

  test('数字 id：DB 未命中 → 404（DB 唯一事实源，不回落 details.json）', async () => {
    const page = await getReplicaDetailPage('392', { loadPost: async () => null });
    assert.equal(page, null);
  });

  test('数字 id：查询异常 → 同样 404', async () => {
    const page = await getReplicaDetailPage('392', {
      loadPost: async () => {
        throw new Error('db down');
      },
    });
    assert.equal(page, null);
  });

  test('slug id：只查 DB（loader 收到原样 slug），未命中无遗留回落 → 404', async () => {
    const slugs: string[] = [];
    const hit = await getReplicaDetailPage('my-new-post', {
      loadPost: async (slug) => {
        slugs.push(slug);
        return { ...dbPost, slug };
      },
    });
    assert.deepEqual(slugs, ['my-new-post']);
    assert.equal(hit!.title, 'DB 里的新文章 - 集智 AI OPC 社区');

    const miss = await getReplicaDetailPage('my-new-post', { loadPost: async () => null });
    assert.equal(miss, null);
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
});

describe('content.ts：/newsdetail id 校验放宽后的同步行为', () => {
  test('数字 id 行为不变（392 仍可解析）', () => {
    assert.ok(getReplicaArticle('392'));
    assert.ok(getReplicaPage('/newsdetail', { id: '392' }));
  });

  test('slug 形态通过校验但 details.json 无此键 → null（DB 解析交给 async 路径）', () => {
    assert.equal(getReplicaArticle('my-new-post'), null);
    assert.equal(getReplicaPage('/newsdetail', { id: 'my-new-post' }), null);
  });

  test('历史拒绝用例不回归', () => {
    for (const id of ['../392', '392/../1', '__proto__', '0', '-1', '1e2', '9999999999']) {
      assert.equal(getReplicaArticle(id), null, id);
    }
    assert.equal(getReplicaPage('/newsdetail', { id: '../392' }), null);
  });
});
