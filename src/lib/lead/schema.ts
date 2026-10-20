import { z } from 'zod';

/** 留资类型：与 PRD §5.9 FR-LEAD-01 一致 */
export const leadTypes = [
  'apply',
  'compute',
  'enterprise',
  'traffic',
  'capital',
  'space',
  'course',
  'market',
  'subscribe',
  'contact',
] as const;

export type LeadType = (typeof leadTypes)[number];

export const leadTypeLabel: Record<LeadType, string> = {
  apply: '申请入驻',
  compute: '算力超市咨询',
  enterprise: '企服超市咨询',
  traffic: '流量赋能咨询',
  capital: '资本政策咨询',
  space: '集智空间入驻',
  course: '课程报名',
  market: '供需对接',
  subscribe: '订阅社区动态',
  contact: '一般咨询',
};

export const contactTypeSchema = z.enum(['phone', 'email']);

/**
 * 同意入驻须知（FR-APPLY-01 / FR-APPLY-03）。
 *
 * 只有「申请入驻」场景必勾，因此**不在 schema 层做必填约束**：
 * schema 是所有留资类型共用的，若在这里按 leadType 强制，
 * 其它留资类型（算力 / 企服 / 流量…）会因为缺这个字段被整条拒掉。
 *
 * 「哪些场景必勾」由 requiresAgreement() 统一给出，
 * 客户端（components/forms/LeadForm）与服务端（app/api/leads/route）共用同一份判定，
 * 避免两边各写一套、久了必然走偏。
 */
export const agreeTermsSchema = z.boolean().optional();

/** 需要勾选同意入驻须知的留资类型（目前只有申请入驻） */
export function requiresAgreement(leadType: LeadType): boolean {
  return leadType === 'apply';
}

/** 未勾选时的提示文案（客户端与服务端共用一份，避免措辞不一致） */
export const AGREEMENT_REQUIRED_MESSAGE = '请阅读并同意上方《入驻须知》后再提交';

export const leadSchema = z.object({
  leadType: z.enum(leadTypes),
  name: z.string().trim().min(1, '请填写姓名').max(40, '姓名过长'),
  contactType: contactTypeSchema,
  contact: z.string().trim().min(1, '请填写联系方式').max(120, '联系方式过长'),
  orgName: z.string().trim().max(80).optional().or(z.literal('')),
  role: z.enum(['创业者', '服务商', '企业', '投资机构', '学员', '其他']).optional(),
  subjectType: z.enum(['个人', '团队', '企业']).optional(),
  teamSize: z.coerce.number().int().min(1).max(999).optional(),
  track: z.string().trim().max(40).optional().or(z.literal('')),
  message: z.string().trim().max(1000, '留言请控制在 1000 字以内').optional().or(z.literal('')),
  sourcePage: z.string().trim().max(200).default('/'),
  sourceRef: z.string().trim().max(200).optional().or(z.literal('')),
  /** 同意入驻须知：仅申请入驻场景必勾，是否必勾见 requiresAgreement() */
  agreeTerms: agreeTermsSchema,
  /** 蜜罐：真实用户不会填，机器人会填。判定在 schema 之前做，这里不做长度限制。 */
  company: z.string().max(200).optional(),
  /** 幂等键：30 分钟内同键不重复入库（窗口判定在 api/leads/route.ts） */
  idempotencyKey: z.string().trim().max(80).optional().or(z.literal('')),
});

export type LeadInput = z.infer<typeof leadSchema>;

/** 手机号（中国大陆） */
export const phoneRe = /^1[3-9]\d{9}$/;
export const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(type: 'phone' | 'email', value: string): string | null {
  if (type === 'phone' && !phoneRe.test(value)) return '请填写有效的 11 位手机号';
  if (type === 'email' && !emailRe.test(value)) return '请填写有效的邮箱地址';
  return null;
}
