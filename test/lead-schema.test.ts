/**
 * 留资表单 zod schema 的正反例校验。
 *
 * 覆盖：必填缺失、姓名长度、枚举值、蜜罐字段、联系方式格式（手机/邮箱）。
 * 只断言 `src/lib/lead/schema.ts` 里真实存在的规则，不臆造行为。
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  leadSchema,
  validateContact,
  leadTypes,
  leadTypeLabel,
  phoneRe,
  emailRe,
} from '@/lib/lead/schema';

/** 一条最小可用的合法留资数据（手机号联系方式） */
const validPhone = {
  leadType: 'apply',
  name: '张三',
  contactType: 'phone',
  contact: '13800138000',
};

type ParseOutcome = ReturnType<typeof leadSchema.safeParse>;

/** 期望校验通过；失败时把 zod 的 issue 列表带进报错信息 */
function parseOk(input: unknown) {
  const result = leadSchema.safeParse(input);
  if (!result.success) {
    assert.fail(`期望校验通过，实际错误：${JSON.stringify(result.error.issues)}`);
  }
  return result.data;
}

/** 取某个字段上的第一条校验错误信息；校验通过时返回 undefined */
function fieldError(result: ParseOutcome, field: string): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((i) => i.path[0] === field)?.message;
}

describe('leadSchema · 正例', () => {
  test('最小合法输入通过校验', () => {
    const result = leadSchema.safeParse(validPhone);
    assert.equal(result.success, true, JSON.stringify(result.error?.issues));
  });

  test('sourcePage 缺省时回落到 "/"', () => {
    const data = parseOk(validPhone);
    assert.equal(data.sourcePage, '/');
  });

  test('空字符串的可选字段被接受（表单留空的常规形态）', () => {
    const data = parseOk({
      ...validPhone,
      orgName: '',
      track: '',
      message: '',
      sourceRef: '',
      idempotencyKey: '',
    });
    assert.equal(data.orgName, '');
  });

  test('teamSize 支持数字字符串并被强制转成整数', () => {
    const data = parseOk({ ...validPhone, teamSize: '12' });
    assert.equal(data.teamSize, 12);
  });

  test('每个 leadTypes 枚举值都能通过校验', () => {
    for (const leadType of leadTypes) {
      const result = leadSchema.safeParse({ ...validPhone, leadType });
      assert.equal(result.success, true, `leadType=${leadType} 应合法`);
    }
  });

  test('leadTypeLabel 覆盖全部枚举值', () => {
    for (const leadType of leadTypes) {
      assert.equal(typeof leadTypeLabel[leadType], 'string');
      assert.ok(leadTypeLabel[leadType].length > 0, `leadType=${leadType} 缺中文标签`);
    }
  });
});

describe('leadSchema · 必填字段缺失', () => {
  const requiredFields = ['leadType', 'name', 'contactType', 'contact'] as const;

  for (const field of requiredFields) {
    test(`缺少 ${field} 时校验失败`, () => {
      const payload: Record<string, unknown> = { ...validPhone };
      delete payload[field];
      const result = leadSchema.safeParse(payload);
      assert.equal(result.success, false, `${field} 缺失应校验失败`);
      assert.ok(fieldError(result, field), `${field} 应有明确的错误信息`);
    });
  }

  test('姓名为空白字符串时失败（trim 后为空）', () => {
    const result = leadSchema.safeParse({ ...validPhone, name: '   ' });
    assert.equal(result.success, false);
    assert.equal(fieldError(result, 'name'), '请填写姓名');
  });

  test('姓名超过 40 字时失败', () => {
    const result = leadSchema.safeParse({ ...validPhone, name: '名'.repeat(41) });
    assert.equal(result.success, false);
    assert.equal(fieldError(result, 'name'), '姓名过长');
  });

  test('联系方式超过 120 字时失败', () => {
    const result = leadSchema.safeParse({ ...validPhone, contact: '1'.repeat(121) });
    assert.equal(result.success, false);
    assert.equal(fieldError(result, 'contact'), '联系方式过长');
  });

  test('留言超过 1000 字时失败', () => {
    const result = leadSchema.safeParse({ ...validPhone, message: '字'.repeat(1001) });
    assert.equal(result.success, false);
    assert.equal(fieldError(result, 'message'), '留言请控制在 1000 字以内');
  });
});

describe('leadSchema · 枚举值', () => {
  test('非法 leadType 被拒绝', () => {
    const result = leadSchema.safeParse({ ...validPhone, leadType: 'not_a_lead_type' });
    assert.equal(result.success, false);
    assert.ok(fieldError(result, 'leadType'));
  });

  test('空 leadType 被拒绝', () => {
    const result = leadSchema.safeParse({ ...validPhone, leadType: '' });
    assert.equal(result.success, false);
    assert.ok(fieldError(result, 'leadType'));
  });

  test('非法 contactType 被拒绝', () => {
    const result = leadSchema.safeParse({ ...validPhone, contactType: 'wechat' });
    assert.equal(result.success, false);
    assert.ok(fieldError(result, 'contactType'));
  });

  test('非法 role 被拒绝', () => {
    const result = leadSchema.safeParse({ ...validPhone, role: '投资人' });
    assert.equal(result.success, false);
    assert.ok(fieldError(result, 'role'));
  });

  test('teamSize 超出 1–999 范围被拒绝', () => {
    assert.equal(leadSchema.safeParse({ ...validPhone, teamSize: 0 }).success, false);
    assert.equal(leadSchema.safeParse({ ...validPhone, teamSize: 1000 }).success, false);
  });
});

describe('leadSchema · 蜜罐字段 company', () => {
  test('company 缺省时不影响校验通过', () => {
    const result = leadSchema.safeParse(validPhone);
    assert.equal(result.success, true);
  });

  test('company 有值时 schema 仍放行——拦截发生在 schema 之前（见 src/app/api/leads/route.ts）', () => {
    const result = leadSchema.safeParse({ ...validPhone, company: 'Acme Corp' });
    assert.equal(result.success, true, 'schema 不承担蜜罐拦截职责');
  });

  test('company 超过 200 字时 schema 拒绝（防止超大 payload）', () => {
    const result = leadSchema.safeParse({ ...validPhone, company: 'x'.repeat(201) });
    assert.equal(result.success, false);
    assert.ok(fieldError(result, 'company'));
  });
});

describe('validateContact · 联系方式格式', () => {
  test('合法手机号通过', () => {
    assert.equal(validateContact('phone', '13800138000'), null);
    assert.equal(phoneRe.test('13800138000'), true);
  });

  test('非法手机号被拒绝', () => {
    assert.equal(validateContact('phone', '12345'), '请填写有效的 11 位手机号');
    // 第二位为 0/1/2 等非法号段
    assert.equal(validateContact('phone', '12800138000'), '请填写有效的 11 位手机号');
    // 位数不足
    assert.equal(validateContact('phone', '1380013800'), '请填写有效的 11 位手机号');
  });

  test('合法邮箱通过', () => {
    assert.equal(validateContact('email', 'a@b.com'), null);
    assert.equal(emailRe.test('a@b.com'), true);
  });

  test('非法邮箱被拒绝', () => {
    assert.equal(validateContact('email', 'not-an-email'), '请填写有效的邮箱地址');
    assert.equal(validateContact('email', 'a@b'), '请填写有效的邮箱地址');
    assert.equal(validateContact('email', 'a b@c.com'), '请填写有效的邮箱地址');
  });
});
