'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui/Button';
import { leadTypeLabel, type LeadType } from '@/lib/lead/schema';

type Props = {
  leadType: LeadType;
  sourcePage: string;
  sourceRef?: string;
  /** 申请入驻专用字段 */
  withApplyFields?: boolean;
  compact?: boolean;
  title?: string;
  desc?: string;
};

const roles = ['创业者', '服务商', '企业', '投资机构', '学员', '其他'] as const;
const tracks = [
  'AI 原生创新',
  'AIGC 创意',
  '智能硬件',
  '产业智能化',
  'AI + 医疗',
  'AI 电商',
  '其他',
] as const;

export default function LeadForm({
  leadType,
  sourcePage,
  sourceRef,
  withApplyFields = false,
  compact = false,
  title,
  desc,
}: Props) {
  const [contactType, setContactType] = useState<'phone' | 'email'>('phone');
  const [status, setStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [idempotencyKey, setIdempotencyKey] = useState('');

  function ensureKey() {
    if (typeof window === 'undefined') return '';
    const storageKey = `jz_lead_key_${leadType}`;
    let k = sessionStorage.getItem(storageKey);
    if (!k) {
      k = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(storageKey, k);
    }
    setIdempotencyKey(k);
    return k;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setMessage('');
    setFieldErrors({});

    const fd = new FormData(e.currentTarget);
    const payload = {
      leadType,
      name: String(fd.get('name') ?? ''),
      contactType,
      contact: String(fd.get('contact') ?? ''),
      orgName: String(fd.get('orgName') ?? ''),
      role: String(fd.get('role') ?? ''),
      subjectType: String(fd.get('subjectType') ?? ''),
      teamSize: fd.get('teamSize') ? Number(fd.get('teamSize')) : undefined,
      track: String(fd.get('track') ?? ''),
      message: String(fd.get('message') ?? ''),
      sourcePage,
      sourceRef: sourceRef ?? '',
      company: String(fd.get('company') ?? ''),
      idempotencyKey: ensureKey(),
    };

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        errors?: Record<string, string>;
      };

      if (res.ok && data.ok) {
        setStatus('ok');
        setMessage('提交成功！社区团队会尽快与你联系。');
        (e.target as HTMLFormElement).reset();
        return;
      }

      setStatus('error');
      setMessage(data.message ?? '提交失败，请稍后重试。');
      if (data.errors) setFieldErrors(data.errors);
    } catch {
      setStatus('error');
      setMessage('网络异常，请稍后重试。');
    }
  }

  if (status === 'ok') {
    return (
      <div
        className={clsx(
          'rounded-2xl border border-[var(--color-brand-teal)]/30 bg-[var(--color-brand-teal)]/8 p-8 text-center',
          compact ? 'p-6' : 'p-10',
        )}
        role="status"
      >
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[var(--color-brand-teal)]/15">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="var(--color-brand-teal)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-[15px] font-medium text-[var(--color-brand-navy)]">{message}</p>
        <p className="mt-2 text-[13px] text-[var(--color-ink-2)]">
          {leadTypeLabel[leadType]}已受理，我们会通过你留下的联系方式对接。
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className={clsx(
        'rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-card)]',
        compact ? 'p-5' : 'p-7 sm:p-9',
      )}
      noValidate
    >
      {title && (
        <h3 className="text-[17px] font-semibold text-[var(--color-brand-navy)]">{title}</h3>
      )}
      {desc && <p className="mt-2 text-[13px] leading-relaxed text-[var(--color-ink-2)]">{desc}</p>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="姓名" name="name" required error={fieldErrors.name}>
          <input
            id="name"
            name="name"
            type="text"
            maxLength={40}
            required
            placeholder="怎么称呼你"
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-brand-blue)]"
          />
        </Field>

        <Field label="联系方式" name="contact" required error={fieldErrors.contact}>
          <div className="flex gap-2">
            <div className="flex shrink-0 overflow-hidden rounded-lg border border-[var(--color-line)]">
              {(['phone', 'email'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setContactType(t)}
                  className={clsx(
                    'px-3 text-[13px] transition-colors',
                    contactType === t
                      ? 'bg-[var(--color-brand-blue)] text-white'
                      : 'bg-white text-[var(--color-ink-2)] hover:bg-[var(--color-surface)]',
                  )}
                >
                  {t === 'phone' ? '手机' : '邮箱'}
                </button>
              ))}
            </div>
            <input
              id="contact"
              name="contact"
              type={contactType === 'phone' ? 'tel' : 'email'}
              required
              maxLength={120}
              placeholder={contactType === 'phone' ? '11 位手机号' : 'name@example.com'}
              className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-brand-blue)]"
            />
          </div>
        </Field>

        <Field label="团队 / 项目名称" name="orgName">
          <input
            id="orgName"
            name="orgName"
            type="text"
            maxLength={80}
            placeholder="选填"
            className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-brand-blue)]"
          />
        </Field>

        <Field label="你的身份" name="role">
          <select
            id="role"
            name="role"
            className="w-full appearance-none rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--color-brand-blue)]"
          >
            <option value="">请选择</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>

        {withApplyFields && (
          <>
            <Field label="申请主体类型" name="subjectType" required>
              <select
                id="subjectType"
                name="subjectType"
                required
                className="w-full appearance-none rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--color-brand-blue)]"
              >
                <option value="">请选择</option>
                <option value="个人">个人</option>
                <option value="团队">团队</option>
                <option value="企业">企业</option>
              </select>
            </Field>

            <Field label="团队人数" name="teamSize">
              <input
                id="teamSize"
                name="teamSize"
                type="number"
                min={1}
                max={999}
                placeholder="选填"
                className="w-full rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-brand-blue)]"
              />
            </Field>

            <Field label="项目 AI 赛道" name="track" required>
              <select
                id="track"
                name="track"
                required
                className="w-full appearance-none rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--color-brand-blue)]"
              >
                <option value="">请选择</option>
                {tracks.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </div>

      <Field label="补充说明" name="message" className="mt-4">
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={1000}
          placeholder="简单介绍你的项目或需求，方便我们提前准备（选填）"
          className="w-full resize-none rounded-lg border border-[var(--color-line)] bg-white px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-[var(--color-ink-3)] focus:border-[var(--color-brand-blue)]"
        />
      </Field>

      {/* 蜜罐：真实用户看不见，机器人会填 */}
      <div className="absolute h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor={`company-${leadType}`}>Company</label>
        <input id={`company-${leadType}`} name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status === 'error' && (
        <p className="mt-4 rounded-lg bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700" role="alert">
          {message}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={status === 'sending'}>
          {status === 'sending' ? '提交中…' : '提交'}
        </Button>
        <p className="text-[12px] leading-relaxed text-[var(--color-ink-3)]">
          提交即表示同意社区使用上述信息与你联系，信息仅用于本次对接。
        </p>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  children,
  required,
  error,
  className,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label
        htmlFor={name}
        className="mb-1.5 block text-[13px] font-medium text-[var(--color-ink)]"
      >
        {label}
        {required && <span className="ml-0.5 text-[var(--color-brand-blue)]">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-[12px] text-red-600">{error}</p>}
    </div>
  );
}
