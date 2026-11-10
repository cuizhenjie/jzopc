import { getSupabaseAdmin } from '@/lib/supabase/server';
import type {
  AdminAccountRow,
  AdminHomeBannerRow,
} from './resources';

/**
 * 资源模块的数据访问层（服务端专用，全部走 service_role）。
 * 列表页只读全量（后台不过滤 published），排序按 sort_order / 创建时间。
 * 未配置 Supabase → 空列表（页面有 dbConfigured 提示条，不再回落种子 —— 后台必须看真实数据）。
 *
 * 2026-11 后台瘦身：仅保留首页 Banner（home_banners）；
 * 2026-11-10 供需数据（原 market_items）改为直读 /market 表单提交的线索
 * （leads 表 lead_type='market'），数据访问在 src/lib/admin/data.ts 的
 * listMarketSubmissions；其余模块的数据访问随维护功能一并下线
 * （前台公开页走 blocks-runtime 直读，不经本文件）。
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
