/**
 * `/llms.txt` 生成器的契约校验。
 *
 * llms.txt 是**给 AI 助手读的站点摘要** —— 它一旦过期，就会把 AI 引向
 * 不存在的入口或不存在的功能，比没有这个文件更糟。所以这里锁死：
 *   1. 规范结构（一级标题 + 引用块摘要 + `##` 分节 + `- [标题](绝对URL): 说明`）；
 *   2. **站点改了什么，摘要必须跟着变**（八大赋能、主要入口、事实数据全部从配置来）；
 *   3. **诚实性**：示例数据与「内容筹备中」必须写明，不能让 AI 当成真实名录。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildLlmsTxt } from '@/lib/site/llms-txt';
import { contentReady, empowerModules, nav, site, stats } from '@/lib/site/config';

const txt = buildLlmsTxt();
const lines = txt.split('\n');

describe('llms.txt · 规范结构', () => {
  test('以 `# 站点名` 开头，紧跟 `>` 引用块摘要', () => {
    assert.equal(lines[0], `# ${site.name}`);
    assert.ok(lines[1] === '', '标题与摘要之间应空一行');
    assert.ok(lines[2].startsWith('> '), '第 3 行应是引用块摘要');
  });

  test('至少有一个 `##` 分节', () => {
    assert.ok(lines.some((l) => l.startsWith('## ')), '缺少分节');
  });

  test('所有链接条目都是绝对 URL 且带说明', () => {
    const entries = lines.filter((l) => l.startsWith('- ['));
    assert.ok(entries.length > 10, '链接条目过少');
    for (const e of entries) {
      // 说明分隔符允许半角「:」或全角「：」
      const m = /^- \[(.+?)\]\((\S+?)\)(?:[:：](.*))?$/.exec(e);
      assert.ok(m, `条目格式不符规范：${e}`);
      assert.ok(
        /^https?:\/\//.test(m[2]),
        `URL 必须是绝对地址（llmstxt.org 要求）：${e}`,
      );
      assert.ok(m[3] && m[3].length > 0, `条目缺少说明：${e}`);
    }
  });
});

describe('llms.txt · 与站点内容同源', () => {
  test('八大赋能全部出现，且各自链接到自己的详情页', () => {
    for (const m of empowerModules) {
      assert.ok(txt.includes(m.title), `缺少赋能：${m.title}`);
      assert.ok(txt.includes(m.href), `缺少赋能链接：${m.href}`);
    }
  });

  test('四项关键指标与配置一致', () => {
    for (const s of stats) {
      assert.ok(txt.includes(`${s.label}：${s.value}${s.suffix}`), `指标不匹配：${s.label}`);
    }
  });

  test('导航一级入口全部出现', () => {
    for (const item of nav) {
      assert.ok(txt.includes(`[${item.label}]`), `缺少导航入口：${item.label}`);
    }
  });

  test('内容未就绪的页面被标注为「内容筹备中」', () => {
    const pending = nav
      .flatMap((i) => i.children ?? [])
      .filter((c) => contentReady[c.href] === false);
    // 关于集智四个子页已下线（2026-10-23），不再有未就绪子页：
    // 有未就绪项时逐个标注；没有时不输出「内容筹备中」段（诚实优先）。
    if (pending.length) {
      for (const c of pending) {
        assert.ok(txt.includes(c.label), `未就绪页面未出现在筹备中清单：${c.label}`);
      }
      assert.ok(txt.includes('内容筹备中'), '缺少「内容筹备中」说明');
    } else {
      assert.ok(!txt.includes('内容筹备中'), '无未就绪页面时不应输出筹备中说明');
    }
  });
});

describe('llms.txt · 诚实性', () => {
  test('明确标注智能体与合作企业为示例数据', () => {
    assert.ok(txt.includes('示例'), '必须说明存在示例数据');
    assert.ok(txt.includes('不应作为真实名录引用'), '必须提醒勿当真实名录');
  });

  test('明确说明不提供登录注册与站内对话', () => {
    assert.ok(txt.includes('不提供登录注册'), '缺少账号体系说明');
    assert.ok(txt.includes('外链'), '缺少「智能体外链」说明');
  });

  test('说明留资路径与响应时效', () => {
    assert.ok(txt.includes('/apply'), '缺少申请入驻入口');
    assert.ok(txt.includes('一个工作日'), '缺少响应时效');
  });
});
