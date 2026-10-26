/**
 * 数据访问层的「未配置 Supabase → 回落到本地种子数据」行为。
 *
 * `src/lib/queries/index.ts` 的设计前提是：没有数据库也能完整跑通。
 * 这条测试锁住该前提，防止有人把 fallback 分支删掉或改坏。
 *
 * 2026-10-26 第二批清理后 queries 只剩**新闻线**（news-runtime →
 * /newslist /activitylist /newsdetail）；智能体 / 课程 / 供需的查询函数
 * 已随旧版原生页下线，这里同步收窄覆盖面。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';
import { getNewsPosts, getNewsPost } from '@/lib/queries';
import { seedNews } from '@/lib/data/seed';

/* 强制走回落分支：清掉 Supabase 相关环境变量（getSupabaseAdmin 是调用时读取） */
for (const key of [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
]) {
  delete process.env[key];
}

describe('未配置 Supabase 时的前提', () => {
  test('getSupabaseAdmin() 返回 null', () => {
    assert.equal(getSupabaseAdmin(), null);
  });

  test('isSupabaseConfigured() 返回 false', () => {
    assert.equal(isSupabaseConfigured(), false);
  });
});

describe('新闻列表查询回落种子数据', () => {
  test('getNewsPosts() 返回全部种子资讯', async () => {
    const news = await getNewsPosts();
    assert.ok(news.length > 0, '资讯列表不应为空');
    assert.equal(news.length, seedNews.length);
    assert.deepEqual(news, seedNews);
  });

  test('getNewsPosts(category) 按分类过滤', async () => {
    const category = seedNews[0].category;
    const news = await getNewsPosts(category);
    assert.ok(news.length > 0, `分类 ${category} 应有数据`);
    assert.ok(news.every((n) => n.category === category));
  });

  test('种子的 category 都是合法类目（沙龙/活动/资讯）', async () => {
    const valid = new Set(['沙龙', '活动', '资讯']);
    for (const n of seedNews) {
      assert.ok(valid.has(n.category), `资讯 ${n.slug} 的分类 ${n.category} 不合法`);
    }
  });
});

describe('新闻详情查询回落种子数据', () => {
  test('getNewsPost(slug) 能命中种子资讯，未知 slug 返回 null', async () => {
    const target = seedNews[0];
    const post = await getNewsPost(target.slug);
    assert.ok(post);
    assert.equal(post?.slug, target.slug);
    assert.equal(await getNewsPost('__no_such_post__'), null);
  });
});
