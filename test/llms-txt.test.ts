/**
 * `/llms.txt` 真生成器的契约校验。
 *
 * ⚠️ 站点实际的 llms.txt / llm.txt 两个 route 都由 `src/lib/opc/llms.ts` 的
 * buildReplicaLlmsTxt 生成（`src/lib/site/llms-txt.ts` 是无人引用的死代码，
 * 已于 2026-10-26 第二批清理删除——别再往那个方向改）。
 *
 * llms.txt 是给 AI 助手读的站点摘要，一旦过期就会把 AI 引向不存在的入口，
 * 比没有更糟。这里锁死：
 *   1. 规范结构（# 站点名、> 摘要引用块、## 分节、绝对 URL 条目）；
 *   2. 导航一级入口全部出现且指向正确路径；
 *   3. 流量超市的站内专页说明存在（2026-10-26 从整页跳转改回站内页）。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildReplicaLlmsTxt } from '@/lib/opc/llms';
import { publicNavigation } from '@/lib/site/navigation';
import { site } from '@/lib/site/config';
import { trafficBase } from '@/lib/data/traffic-base';

const txt = buildReplicaLlmsTxt();
const lines = txt.split('\n');
const base = site.url.replace(/\/$/, '');

describe('llms.txt · 规范结构', () => {
  test('以 `# 站点名` 开头，第 3 行是 `>` 引用块摘要', () => {
    assert.ok(lines[0].startsWith('# '), '首行应是一级标题');
    assert.equal(lines[1], '', '标题与摘要之间应空一行');
    assert.ok(lines[2].startsWith('> '), '第 3 行应是引用块摘要');
  });

  test('规范入口的条目都是绝对 URL', () => {
    const entries = lines.filter((l) => l.startsWith('- ['));
    assert.ok(entries.length >= 8, '入口条目过少');
    for (const e of entries) {
      const m = /^- \[(.+?)\]\((\S+?)\)/.exec(e);
      assert.ok(m, `条目格式不符：${e}`);
      assert.ok(
        /^https?:\/\//.test(m[2]),
        `URL 必须是绝对地址（llmstxt.org 要求）：${e}`,
      );
    }
  });
});

describe('llms.txt · 与站点内容同源', () => {
  test('导航一级入口全部出现且链接到本站对应路径', () => {
    for (const item of publicNavigation) {
      assert.ok(txt.includes(`[${item.label}]`), `缺少导航入口：${item.label}`);
      assert.ok(
        txt.includes(`(${base}${item.href})`),
        `${item.label} 应链接到 ${base}${item.href}`,
      );
    }
  });

  test('流量超市带站内专页说明（不再是整页跳转独立站）', () => {
    assert.ok(txt.includes(trafficBase.name), '应出现流量基地全名');
    assert.ok(txt.includes(trafficBase.slogan), '应出现流量基地方向描述');
    assert.ok(!txt.includes('th.jimei.cn'), '不得再引用独立站跳转地址');
  });
});
