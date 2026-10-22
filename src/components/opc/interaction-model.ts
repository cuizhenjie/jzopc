/** Small, framework-independent rules shared by the snapshot interaction adapter. */
export type ReplicaField = { label: string; value: string; type: string; required: boolean };
export type FieldError = { index: number; message: string };

export function normalizedText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/g, ' ').trim();
}

export function facetMatches(text: string, categories: readonly string[], category: string, query: string): boolean {
  const all = !category || /^(全部|全部课程|全部城市|全部区域|all)$/i.test(category);
  const categoryMatch = all || categories.some(item => normalizedText(item) === normalizedText(category));
  return categoryMatch && normalizedText(text).includes(normalizedText(query));
}

export function parseCategories(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [value];
  } catch { return [value]; }
}

/** Validation never implies authentication, SMS delivery or application persistence. */
export function validateReplicaFields(fields: readonly ReplicaField[], mode: string): FieldError[] {
  const errors: FieldError[] = [];
  const passwords = fields.map((field, index) => ({ field, index }))
    .filter(({ field }) => field.type === 'password' || /密码/.test(field.label));
  fields.forEach((field, index) => {
    const value = field.value.trim();
    let message = '';
    if (field.required && !value) message = `请填写${field.label || '此项'}`;
    else if (value && (field.type === 'tel' || /手机号|联系电话/.test(field.label)) && !/^1[3-9]\d{9}$/.test(value)) message = '请填写有效的11位手机号';
    else if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) message = '请填写有效的邮箱地址';
    else if (value && /验证码/.test(field.label) && !/^\d{6}$/.test(value)) message = '请输入6位数字验证码';
    else if (value && /register|forgot/.test(mode) && passwords[0]?.index === index && field.value.length < 6) message = '密码至少需要6位';
    else if (value && passwords.length > 1 && passwords.at(-1)?.index === index && field.value !== passwords[0].field.value) message = '两次输入的密码不一致';
    if (message) errors.push({ index, message });
  });
  return errors;
}
