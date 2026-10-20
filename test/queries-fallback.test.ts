/**
 * 数据访问层的「未配置 Supabase → 回落到本地种子数据」行为。
 *
 * `src/lib/queries/index.ts` 的设计前提是：没有数据库也能完整跑通。
 * 这条测试锁住该前提，防止有人把 fallback 分支删掉或改坏。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/server';
import {
  getAgents,
  getAgent,
  getNewsPosts,
  getNewsPost,
  getCourses,
  getCourse,
  getMarketItems,
  getMarketItem,
  getStats,
  getPartners,
  getEmpowerModules,
  getAgentCategories,
} from '@/lib/queries';
import { seedAgents, seedCourses, seedMarket, seedNews } from '@/lib/data/seed';
import { stats, partners, empowerModules, agentCategories } from '@/lib/site/config';

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

describe('列表查询回落种子数据', () => {
  test('getAgents() 返回全部种子智能体', async () => {
    const agents = await getAgents();
    assert.ok(agents.length > 0, '智能体列表不应为空');
    assert.equal(agents.length, seedAgents.length);
    assert.deepEqual(agents, seedAgents);
  });

  test('getAgents(category) 只返回该分类，且分类值合法', async () => {
    const category = agentCategories[0].slug;
    const agents = await getAgents(category);
    assert.ok(agents.length > 0, `分类 ${category} 应有数据`);
    assert.ok(agents.every((a) => a.category === category));
    const known = new Set<string>(agentCategories.map((c) => c.slug));
    assert.ok(
      agents.every((a) => known.has(a.category)),
      '智能体分类必须来自 agentCategories',
    );
  });

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

  test('getCourses() 返回全部种子课程', async () => {
    const courses = await getCourses();
    assert.ok(courses.length > 0, '课程列表不应为空');
    assert.equal(courses.length, seedCourses.length);
    assert.deepEqual(courses, seedCourses);
  });

  test('getMarketItems() 返回全部种子供需条目', async () => {
    const items = await getMarketItems();
    assert.ok(items.length > 0, '供需列表不应为空');
    assert.equal(items.length, seedMarket.length);
    assert.deepEqual(items, seedMarket);
  });

  test('getMarketItems(type) 按供需类型过滤', async () => {
    const demand = await getMarketItems('demand');
    const supply = await getMarketItems('supply');
    assert.ok(demand.length > 0, '需求列表不应为空');
    assert.ok(supply.length > 0, '供给列表不应为空');
    assert.ok(demand.every((m) => m.type === 'demand'));
    assert.ok(supply.every((m) => m.type === 'supply'));
  });

  test('getStats() 返回首页指标', async () => {
    const s = await getStats();
    assert.ok(s.length > 0, '指标不应为空');
    assert.equal(s.length, stats.length);
    for (const item of s) {
      assert.equal(typeof item.key, 'string');
      assert.equal(typeof item.value, 'number');
      assert.equal(typeof item.label, 'string');
    }
  });

  test('getPartners() 返回合作企业列表', async () => {
    const p = await getPartners();
    assert.ok(p.length > 0, '合作企业不应为空');
    assert.equal(p.length, partners.length);
  });

  test('getEmpowerModules() / getAgentCategories() 返回八大赋能与智能体分类', async () => {
    const modules = await getEmpowerModules();
    const categories = await getAgentCategories();
    assert.equal(modules.length, empowerModules.length);
    assert.equal(modules.length, 8, '八大赋能应为 8 条');
    assert.equal(categories.length, agentCategories.length);
  });
});

describe('详情查询回落种子数据', () => {
  test('getAgent(slug) 能命中种子智能体', async () => {
    const target = seedAgents[0];
    const agent = await getAgent(target.slug);
    assert.ok(agent, `应能查到智能体 ${target.slug}`);
    assert.equal(agent?.slug, target.slug);
    assert.equal(agent?.name, target.name);
  });

  test('getAgent(未知 slug) 返回 null', async () => {
    assert.equal(await getAgent('__no_such_agent__'), null);
  });

  test('getNewsPost(slug) 能命中种子资讯，未知 slug 返回 null', async () => {
    const target = seedNews[0];
    const post = await getNewsPost(target.slug);
    assert.ok(post);
    assert.equal(post?.slug, target.slug);
    assert.equal(await getNewsPost('__no_such_post__'), null);
  });

  test('getCourse(slug) 能命中种子课程，未知 slug 返回 null', async () => {
    const target = seedCourses[0];
    const course = await getCourse(target.slug);
    assert.ok(course);
    assert.equal(course?.slug, target.slug);
    assert.equal(await getCourse('__no_such_course__'), null);
  });

  test('getMarketItem(slug) 能命中种子供需条目，未知 slug 返回 null', async () => {
    const target = seedMarket[0];
    const item = await getMarketItem(target.slug);
    assert.ok(item);
    assert.equal(item?.slug, target.slug);
    assert.equal(await getMarketItem('__no_such_item__'), null);
  });
});
