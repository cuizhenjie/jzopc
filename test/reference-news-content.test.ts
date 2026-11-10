/**
 * 参考站 5 篇社区动态 → 动态富文本 → 可浏览详情页的完整数据契约。
 * 全程读取本地快照并注入 fixture，不连接或修改真实数据库。
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseReferenceNews } from '../scripts/reference-news-content.mjs';
import { getReplicaDetailPage, renderArticleBody, renderNewsCard } from '@/lib/opc/news-runtime';

const pages = JSON.parse(readFileSync('src/lib/opc/generated/pages.json', 'utf8')) as Record<string, { html: string }>;
const articles = parseReferenceNews(pages['/news']?.html ?? '');

describe('参考站新闻 · 动态卡片跳转', () => {
  test('5 个数据库卡片头都直接链接到各自详情页', () => {
    const html = articles.map((article) => renderNewsCard(article)).join('');
    const hrefs = [...html.matchAll(/<a class="nitem__hd" href="\/newsdetail\?id=(opc-ref-\d+)">/g)].map((match) => match[1]);
    assert.deepEqual(hrefs, ['opc-ref-01', 'opc-ref-02', 'opc-ref-03', 'opc-ref-04', 'opc-ref-05']);
  });
});

describe('参考站新闻 · 动态富文本数据', () => {
  test('解析出 5 篇稳定 slug，每篇正文是一个完整 HTML 段', () => {
    assert.equal(articles.length, 5);
    assert.deepEqual(articles.map((article) => article.slug), [
      'opc-ref-01', 'opc-ref-02', 'opc-ref-03', 'opc-ref-04', 'opc-ref-05',
    ]);
    for (const article of articles) {
      assert.equal(article.body.length, 1, article.slug);
      assert.ok(article.body[0].includes('<p>'), article.slug);
      assert.ok(article.body[0].includes('<figure class="nfig">'), `${article.slug} 缺配图`);
      assert.ok(article.body[0].includes('<figcaption>'), `${article.slug} 缺图注`);
      assert.ok(article.body[0].includes('<p class="nsrc">'), `${article.slug} 缺来源`);
      assert.match(article.body[0], /<a href="https:\/\/[^"]+" target="_blank" rel="noopener noreferrer">阅读原文 ↗<\/a>/);
    }
  });

  test('加粗、图片、图注和外部原文链接经过公开净化后仍保留', () => {
    const html = renderArticleBody(articles.map((article) => article.body[0]));
    assert.ok(html.includes('<b>真金白银的部分：</b>'));
    assert.equal((html.match(/<figure(\s|>)/g) ?? []).length, 5);
    assert.equal((html.match(/<figcaption(\s|>)/g) ?? []).length, 5);
    assert.equal((html.match(/<img /g) ?? []).length, 5);
    assert.equal((html.match(/阅读原文 ↗/g) ?? []).length, 5);
    assert.ok(html.includes('href="https://news.qq.com/rain/a/20261102A0BGFY00"'));
    assert.doesNotMatch(html, /<script\b|<iframe\b|\son\w+\s*=|javascript:/i);
  });

  test('5 个 slug 都能渲染独立详情，正文图片与来源完整', async () => {
    for (const article of articles) {
      const page = await getReplicaDetailPage(article.slug, { loadPost: async () => article });
      assert.ok(page, article.slug);
      assert.ok(page!.html.includes(article.title), article.slug);
      assert.ok(page!.html.includes('<figure'), `${article.slug} 详情缺图`);
      assert.ok(page!.html.includes('<figcaption'), `${article.slug} 详情缺图注`);
      assert.ok(page!.html.includes('阅读原文 ↗'), `${article.slug} 详情缺原文链接`);
      assert.doesNotMatch(page!.html, /__OPC_(?:TITLE|CATEGORY|DATE|ARTICLE)__/);
    }
  });
});
