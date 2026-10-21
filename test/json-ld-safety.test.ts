import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { toSafeJsonLd } from '@/lib/seo/safe-json';

/**
 * JSON-LD 注入安全（存储型 XSS）。
 *
 * 链路：访客在留资表单填的「团队名称 / 项目名称」→ 运营复制成供需条目或动态的
 * 标题 → 标题进入 JSON-LD 的 `name` → 每个访问该页面的访客都会执行注入的脚本。
 *
 * 回归测试必须锁住两点：**脚本块内不得再出现 `</script>`**，且
 * **JSON 语义逐字不变**（爬虫读到的仍是原始标题）。
 */
describe('JSON-LD 注入安全', () => {
  const payload = '</script><img src=x onerror="window.__xss=1">';

  test('脚本块内的 </script> 被转义（不会提前结束脚本块）', () => {
    const html = toSafeJsonLd({ name: payload });
    assert.doesNotMatch(
      html,
      /<\/script/i,
      '序列化结果里不能出现未转义的 </script —— HTML 解析器会据此结束脚本块',
    );
    assert.doesNotMatch(html, /<[a-z]/i, '序列化结果里不能出现未转义的 HTML 标签起始符');
  });

  test('JSON 语义逐字不变（爬虫读到的还是原始内容）', () => {
    const parsed = JSON.parse(toSafeJsonLd({ name: payload }));
    assert.equal(parsed.name, payload, '转义后必须能被 JSON.parse 还原成原字符串');
  });

  test('嵌套结构里的注入同样被转义', () => {
    const data = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: 'https://example.com/' },
        { '@type': 'ListItem', position: 2, name: payload },
      ],
    };
    const html = toSafeJsonLd(data);
    assert.doesNotMatch(html, /<\/script/i);
    assert.equal(JSON.parse(html).itemListElement[1].name, payload);
  });

  test('& 也被转义（避免实体提前解析）', () => {
    const html = toSafeJsonLd({ name: 'A & B' });
    assert.doesNotMatch(html, /&(?!u0026)/, '裸的 & 应被转义');
    assert.equal(JSON.parse(html).name, 'A & B');
  });

  test('U+2028 / U+2029 被转义（否则 JSON.parse 会抛错）', () => {
    const html = toSafeJsonLd({ name: 'a\u2028b\u2029c' });
    assert.doesNotMatch(html, /[\u2028\u2029]/);
    assert.equal(JSON.parse(html).name, 'a\u2028b\u2029c');
  });

  test('正常内容不受影响（不误伤）', () => {
    const data = { '@type': 'Organization', name: '北京集美科技有限公司' };
    assert.equal(toSafeJsonLd(data), JSON.stringify(data));
  });
});
