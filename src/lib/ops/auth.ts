import { timingSafeEqual } from 'node:crypto';

export function tokenMatches(input: string | undefined | null): boolean {
  const expected = process.env.OPS_TOKEN;
  if (!expected) return false;
  if (!input) return false;
  const a = Buffer.from(String(input));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const opsCookieName = 'jz_ops_token';
