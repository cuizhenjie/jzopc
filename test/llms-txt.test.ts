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
 *   2. 导航一级入口全部出现且指向正确路径（**9 项**，与参考站菜单一致）；
 *   3. 10 个页面链接齐备；
 *   4. 关于集智的 4 个锚点写明；
 *   5. 旧路由的 308 收敛关系写明（AI 才不会把 AI 助手引到死链）。
 *
 * 删除的旧断言（逐条说明）：
 *   - 「流量超市带站内专页说明（trafficBase.name / slogan，不再引用 th.jimei.cn）」
 *     → 旧站独立页的数据源 traffic-base.ts 已下线，流量赋能现在是参考站的
 *       /growth 页面；llms.txt 里对应的是「流量赋能」入口。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildReplicaLlmsTxt } from '@/lib/opc/llms';
import { publicNavigation } from '@/lib/site/navigation';
import { site } from '@/lib/site/config';
import { replicaPaths } from '@/lib/opc/routes';

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

  test('站点名与全站口径一致', () => {
    assert.equal(lines[0], '# 集智 AI OPC 社区');
    assert.ok(txt.includes('北京丰台大红门'));
  });
});

describe('llms.txt · 与站点内容同源', () => {
  test('导航一级入口全部出现且链接到本站对应路径（9 项）', () => {
    assert.equal(publicNavigation.length, 9);
    for (const item of publicNavigation) {
      assert.ok(txt.includes(`[${item.label}]`), `缺少导航入口：${item.label}`);
      assert.ok(
        txt.includes(`(${base}${item.href})`),
        `${item.label} 应链接到 ${base}${item.href}`,
      );
    }
  });

  test('页面分节列出 10 个公开页面链接（不含 DB 驱动的 /newsdetail）', () => {
    const start = txt.indexOf('## 页面');
    const section = txt.slice(start, txt.indexOf('## 站点地图'));
    const entries = [...section.matchAll(/^- \[(.+?)\]\((\S+?)\)/gm)];
    assert.equal(entries.length, 10, `页面链接应为 10 条，实际 ${entries.length}`);
    const paths = entries.map((entry) => entry[2].replace(base, ''));
    assert.deepEqual(paths.sort(), replicaPaths.filter((path) => path !== '/newsdetail').sort());
  });

  test('关于集智的 4 个锚点写明', () => {
    for (const [label, anchor] of [
      ['集智简介', 'intro'],
      ['发展历程', 'history'],
      ['服务对象', 'who'],
      ['生态伙伴', 'eco'],
    ]) {
      assert.ok(txt.includes(`${label}（/about#${anchor}）`), `缺少锚点说明：${label} /about#${anchor}`);
    }
  });

  test('旧路由的 308 收敛关系写明（AI 助手不会把 AI 引到死链）', () => {
    assert.ok(txt.includes('/newslist'), '缺少 /newslist 收敛说明');
    assert.ok(txt.includes('/center'), '缺少 /center 收敛说明');
    assert.ok(txt.includes('/traffic'), '缺少 /traffic 收敛说明');
    assert.ok(txt.includes('永久重定向到 /news、/academy、/growth'), '缺少收敛目标说明');
  });

  test('流量赋能指向站内 /growth（不再引用独立站）', () => {
    assert.ok(txt.includes('流量赋能'), '缺少流量赋能入口');
    assert.ok(txt.includes(`(${base}/growth)`), '流量赋能应指向 /growth');
    assert.ok(!txt.includes('th.jimei.cn'), '不得再引用独立站跳转地址');
  });

  test('说明参考站来源与后台维护边界', () => {
    assert.ok(txt.includes('https://jizhi-ai-opc.app.workbuddy.host/'), '缺少参考站来源说明');
    assert.ok(txt.includes('由后台数据库维护'), '缺少后台维护边界说明');
  });
});

describe('llms.txt · 不含旧站文案', () => {
  test('不得出现旧站品牌与旧口径', () => {
    for (const stale of [
      'opcstore.com', 'OPC Store', 'OPCStore', '同橙', 'tongcheng',
      '233', '158', 'AI ECOSYSTEM', '西马场', '豆包',
    ]) {
      assert.ok(!txt.includes(stale), `llms.txt 仍含旧文案：${stale}`);
    }
  });

  test('不得出现已下线页面的入口链接', () => {
    for (const path of ['/newslist', ']/center', ']/traffic', ']/work', ']/zone']) {
      assert.ok(!txt.includes(`(${base}${path})`), `llms.txt 仍把 ${path} 当成入口`);
    }
  });
});
