import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * 服务端 Supabase 客户端。
 *
 * 设计原则：**未配置 Supabase 时不报错，返回 null**，上层自动回落到本地种子数据。
 * 这样 `pnpm dev` / `pnpm build` 在没有数据库的环境下也能完整跑通，
 * 接入真实 Supabase 后无需改任何调用方代码。
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
