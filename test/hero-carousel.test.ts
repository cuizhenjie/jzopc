import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { stepIndex } from '@/lib/opc/hero-carousel';

describe('首页轮播步进', () => {
  test('向后向前都环绕', () => {
    assert.equal(stepIndex(0, 3, 1), 1);
    assert.equal(stepIndex(2, 3, 1), 0);
    assert.equal(stepIndex(0, 3, -1), 2);
  });

  test('大幅步进按张数取余', () => {
    assert.equal(stepIndex(1, 4, 6), 3);
    assert.equal(stepIndex(1, 4, -6), 3);
  });

  test('没有幻灯片时停在 0', () => {
    assert.equal(stepIndex(2, 0, 1), 0);
    assert.equal(stepIndex(Number.NaN, 3, Number.NaN), 0);
  });
});
