import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { facetMatches, parseCategories, parseStatNumber, validateReplicaFields } from '@/components/opc/interaction-model';

describe('OPC snapshot filtering', () => {
  test('search and category combine, including Unicode normalization', () => {
    assert.equal(facetMatches('LivePPT AI演示文稿', ['热门工具', 'AI办公工具'], 'AI办公工具', 'liveppt'), true);
    assert.equal(facetMatches('LivePPT AI演示文稿', ['热门工具', 'AI办公工具'], 'AI编程工具', 'liveppt'), false);
    assert.equal(facetMatches('ＡＩ 设计', ['AI设计工具'], '全部', 'ai 设计'), true);
    assert.equal(facetMatches('LivePPT', ['热门工具'], '全部', '不存在的内容'), false);
  });
  test('untrusted category values cannot become executable data', () => {
    assert.deepEqual(parseCategories('["南京",5,null,"上海"]'), ['南京', '上海']);
    assert.deepEqual(parseCategories('{invalid'), ['{invalid']);
  });
});

describe('OPC local form validation', () => {
  test('required, phone and email errors preserve field indices', () => {
    const errors = validateReplicaFields([
      { label: '姓名', value: '', type: 'text', required: true },
      { label: '手机号码', value: '123', type: 'tel', required: true },
      { label: '邮箱', value: 'invalid@', type: 'email', required: true },
    ], '/starjoin');
    assert.deepEqual(errors.map(error => error.index), [0, 1, 2]);
  });
  test('password reveal does not remove password validation and mismatches are rejected', () => {
    assert.deepEqual(validateReplicaFields([
      { label: '密码', value: 'abcdef', type: 'password', required: true },
      { label: '确认密码', value: 'abcdeg', type: 'password', required: true },
    ], '/opcregister').map(error => error.message), ['两次输入的密码不一致']);
    assert.equal(validateReplicaFields([{ label: '密码', value: 'abc', type: 'password', required: true }], '/opcregister')[0].message, '密码至少需要6位');
  });
  test('valid local validation returns no persistence or authentication result', () => {
    assert.deepEqual(validateReplicaFields([
      { label: '手机号码', value: '13800138000', type: 'tel', required: true },
      { label: '密码', value: 'abcdef', type: 'password', required: true },
    ], '/opclogin'), []);
  });
});

describe('banner stat count-up parsing', () => {
  test('integer prefix plus suffix parses with trim; everything else stays untouched', () => {
    // 首页四项指标的现行形态
    assert.deepEqual(parseStatNumber('500+'), { value: 500, suffix: '+' });
    assert.deepEqual(parseStatNumber('1000+'), { value: 1000, suffix: '+' });
    assert.deepEqual(parseStatNumber('100+'), { value: 100, suffix: '+' });
    assert.deepEqual(parseStatNumber('50+'), { value: 50, suffix: '+' });
    // 前后空白容忍
    assert.deepEqual(parseStatNumber(' 100+ '), { value: 100, suffix: '+' });
    // 不动原文的形态：小数 / 千分位 / 非数字开头 / 零 / 空值
    assert.equal(parseStatNumber('1.5万'), null);
    assert.equal(parseStatNumber('3,000+'), null);
    assert.equal(parseStatNumber('万级'), null);
    assert.equal(parseStatNumber('0'), null);
    assert.equal(parseStatNumber(''), null);
  });
});
