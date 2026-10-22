/**
 * 管理后台（/admin）核心纯函数的单测：新闻 schema、正文拆分、行转换、CSV 导出。
 *
 * 不需要数据库——数据访问层（src/lib/admin/data.ts）的查询依赖 Supabase 客户端，
 * 这里只测无副作用函数。DDL 列契约见 test/db-schema-contract.test.ts。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  newsInputSchema,
  splitBody,
  toNewsRow,
  autoSlug,
} from '@/lib/admin/news-schema';
import { csvEscape, leadsToCsv, LEAD_CSV_COLUMNS } from '@/lib/admin/data';

/** 一条合法的新闻表单输入 */
const validNews = {
  title: '集智第 3 期 AI 沙龙回顾',
  slug: 'salon-3-recap',
  summary: '一期沙龙的完整回顾。',
  category: '沙龙',
  author: '集智运营',
  status: 'published',
  cover_url: '',
  bodyText: '第一段。\n\n第二段。',
  published_at: '2026-10-22T10:00',
};

describe('newsInputSchema', () => {
  test('合法输入通过', () => {
    const parsed = newsInputSchema.safeParse(validNews);
    assert.equal(parsed.success, true);
  });

  test('缺标题 / 摘要 / 正文被拒绝', () => {
    for (const key of ['title', 'summary', 'bodyText'] as const) {
      const bad = { ...validNews };
      delete bad[key];
      assert.equal(newsInputSchema.safeParse(bad).success, false, `${key} 缺失应校验失败`);
    }
  });

  test('slug 非法字符被拒绝（下划线、中文、首尾中划线）；大写被归一为小写', () => {
    // toLowerCase 归一化：'Abc' → 'abc' 合法（NewsForm 输入框同样自动转小写）
    const normalized = newsInputSchema.safeParse({ ...validNews, slug: 'Abc' });
    assert.equal(normalized.success, true);
    if (normalized.success) assert.equal(normalized.data.slug, 'abc');

    for (const slug of ['a_b', '中文slug', '-abc', 'abc-']) {
      assert.equal(
        newsInputSchema.safeParse({ ...validNews, slug }).success,
        false,
        `slug=${slug} 应校验失败`,
      );
    }
  });

  test('分类必须是沙龙/活动/资讯', () => {
    assert.equal(newsInputSchema.safeParse({ ...validNews, category: '公告' }).success, false);
  });

  test('状态必须是 draft/published/archived', () => {
    assert.equal(newsInputSchema.safeParse({ ...validNews, status: 'online' }).success, false);
  });

  test('cover_url 空串归一为 null，非法 URL 拒绝', () => {
    const ok = newsInputSchema.safeParse(validNews);
    assert.equal(ok.success, true);
    if (ok.success) assert.equal(ok.data.cover_url, null);
    assert.equal(
      newsInputSchema.safeParse({ ...validNews, cover_url: 'not-a-url' }).success,
      false,
    );
  });

  test('published_at 只接受日期或日期时间格式', () => {
    assert.equal(newsInputSchema.safeParse({ ...validNews, published_at: '2026-01-02' }).success, true);
    assert.equal(newsInputSchema.safeParse({ ...validNews, published_at: '2026-01-02T09:30' }).success, true);
    assert.equal(newsInputSchema.safeParse({ ...validNews, published_at: '明天' }).success, false);
  });
});

describe('splitBody / toNewsRow / autoSlug', () => {
  test('按行拆分段落，空行与首尾空白被丢弃，兼容 CRLF', () => {
    assert.deepEqual(splitBody('  a \r\n\r\nb\n\n  \nc'), ['a', 'b', 'c']);
  });

  test('toNewsRow：body 是段落数组，作者空串归一为 null', () => {
    const parsed = newsInputSchema.parse({ ...validNews, author: '' });
    const row = toNewsRow(parsed) as Record<string, unknown>;
    assert.deepEqual(row.body, ['第一段。', '第二段。']);
    assert.equal(row.author, null);
    assert.equal(row.slug, 'salon-3-recap');
  });

  test('toNewsRow：published_at 缺省时用当前时间，始终是合法 ISO 串', () => {
    const parsed = newsInputSchema.parse({ ...validNews, published_at: '' });
    const row = toNewsRow(parsed) as { published_at: string };
    assert.equal(Number.isNaN(new Date(row.published_at).getTime()), false);
  });

  test('autoSlug 生成的 slug 恒通过 schema 校验', () => {
    for (let i = 0; i < 20; i++) {
      assert.equal(newsInputSchema.safeParse({ ...validNews, slug: autoSlug() }).success, true);
    }
  });
});

describe('CSV 导出', () => {
  test('csvEscape：RFC 4180 转义（逗号/引号/换行）与空值', () => {
    assert.equal(csvEscape('plain'), 'plain');
    assert.equal(csvEscape('a,b'), '"a,b"');
    assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
    assert.equal(csvEscape('line1\nline2'), '"line1\nline2"');
    assert.equal(csvEscape(null), '');
    assert.equal(csvEscape(undefined), '');
  });

  test('csvEscape：对象序列化为 JSON 并整体转义（utm 列）', () => {
    assert.equal(csvEscape({ utm_source: 'baidu' }), '"{""utm_source"":""baidu""}"');
  });

  test('leadsToCsv：BOM 前缀 + 中文表头 + 转义单元格 + CRLF 分隔', () => {
    const csv = leadsToCsv([
      {
        id: 1,
        lead_type: 'apply',
        name: '张,三',
        contact_type: 'phone',
        contact: '13800138000',
        org_name: null,
        role: null,
        subject_type: null,
        team_size: null,
        track: null,
        message: null,
        source_page: '/apply',
        source_ref: null,
        utm: null,
        status: 'new',
        note: null,
        created_at: '2026-10-22T00:00:00Z',
        updated_at: '2026-10-22T00:00:00Z',
      },
    ]);
    assert.ok(csv.startsWith('\uFEFF'), '缺 BOM（Excel 中文乱码）');
    assert.ok(csv.includes('ID,类型,姓名'));
    assert.ok(csv.includes('"张,三"'));
    assert.ok(csv.includes('\r\n'));
  });

  test('CSV 列清单覆盖线索的核心字段（状态/备注/UTM 均在）', () => {
    const keys = LEAD_CSV_COLUMNS.map((c) => String(c.key));
    for (const must of ['status', 'note', 'utm', 'contact', 'message', 'created_at']) {
      assert.ok(keys.includes(must), `CSV 缺少关键列：${must}`);
    }
  });
});
