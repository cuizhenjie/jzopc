import { getSupabaseAdmin } from '@/lib/supabase/server';
import type {
  AdminAccountRow,
  AdminHomeBannerRow,
  AdminMarketRow,
} from './resources';

/**
 * 资源模块的数据访问层（服务端专用，全部走 service_role）。
 * 列表页只读全量（后台不过滤 published），排序按 sort_order / 创建时间。
 * 未配置 Supabase → 空列表（页面有 dbConfigured 提示条，不再回落种子 —— 后台必须看真实数据）。
 *
 * 2026-11 后台瘦身：仅保留供需数据（market_items）与首页 Banner（home_banners）；
 * 其余模块的数据访问随维护功能一并下线（前台公开页走 blocks-runtime 直读，不经本文件）。
 */

async function listAll<T>(table: string, order: { column: string; ascending: boolean }[]): Promise<T[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    let q = sb.from(table).select('*');
    for (const o of order) q = q.order(o.column, { ascending: o.ascending, nullsFirst: false });
    const { data, error } = await q;
    if (error) {
      console.error(`[admin:${table}-list] 查询失败：${error.message}`);
      return [];
    }
    return (data ?? []) as T[];
  } catch (e) {
    console.error(`[admin:${table}-list] 查询异常`, e);
    return [];
  }
}

export async function listMarketItems(): Promise<AdminMarketRow[]> {
  return listAll<AdminMarketRow>('market_items', [
    { column: 'published_at', ascending: false },
    { column: 'id', ascending: false },
  ]);
}

export async function getMarketItemById(id: number): Promise<AdminMarketRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from('market_items').select('*').eq('id', id).maybeSingle();
  return (data as AdminMarketRow) ?? null;
}

export async function listHomeBanners(): Promise<AdminHomeBannerRow[]> {
  return listAll<AdminHomeBannerRow>('home_banners', [
    { column: 'sort_order', ascending: true },
    { column: 'id', ascending: true },
  ]);
}

/** 管理员账号列表（绝不出返回 password_hash —— 高敏感列，不进 select） */
export async function listAdminAccounts(): Promise<AdminAccountRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from('admin_users')
      .select('id, username, display_name, is_active, last_login_at, created_at')
      .order('id', { ascending: true });
    if (error) {
      console.error(`[admin:admin_users-list] 查询失败：${error.message}`);
      return [];
    }
    return (data ?? []) as AdminAccountRow[];
  } catch (e) {
    console.error('[admin:admin_users-list] 查询异常', e);
    return [];
  }
}
