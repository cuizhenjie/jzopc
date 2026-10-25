import { getSupabaseAdmin } from '@/lib/supabase/server';
import type {
  AdminAccountRow,
  AdminAgentRow,
  AdminCourseRow,
  AdminEmpowerRow,
  AdminMarketRow,
  AdminMediaRow,
  AdminPartnerRow,
  AdminSiteContentRow,
  AdminSiteStatRow,
} from './resources';

/**
 * 资源模块的数据访问层（服务端专用，全部走 service_role）。
 * 列表页只读全量（后台不过滤 published），排序按 sort_order / 创建时间。
 * 未配置 Supabase → 空列表（页面有 dbConfigured 提示条，不再回落种子 —— 后台必须看真实数据）。
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

export async function listAgents(): Promise<AdminAgentRow[]> {
  return listAll<AdminAgentRow>('agents', [
    { column: 'sort_order', ascending: true },
    { column: 'id', ascending: false },
  ]);
}

export async function getAgentById(id: number): Promise<AdminAgentRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from('agents').select('*').eq('id', id).maybeSingle();
  return (data as AdminAgentRow) ?? null;
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

export async function listCourses(): Promise<AdminCourseRow[]> {
  return listAll<AdminCourseRow>('courses', [
    { column: 'sort_order', ascending: true },
    { column: 'id', ascending: false },
  ]);
}

export async function getCourseById(id: number): Promise<AdminCourseRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from('courses').select('*').eq('id', id).maybeSingle();
  return (data as AdminCourseRow) ?? null;
}

export async function listPartners(): Promise<AdminPartnerRow[]> {
  return listAll<AdminPartnerRow>('partners', [
    { column: 'sort_order', ascending: true },
    { column: 'id', ascending: false },
  ]);
}

export async function getPartnerById(id: number): Promise<AdminPartnerRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from('partners').select('*').eq('id', id).maybeSingle();
  return (data as AdminPartnerRow) ?? null;
}

export async function listSiteStats(): Promise<AdminSiteStatRow[]> {
  return listAll<AdminSiteStatRow>('site_stats', [{ column: 'sort_order', ascending: true }]);
}

export async function listEmpowerModules(): Promise<AdminEmpowerRow[]> {
  return listAll<AdminEmpowerRow>('empower_modules', [
    { column: 'sort_order', ascending: true },
    { column: 'index_no', ascending: true },
  ]);
}

export async function getEmpowerBySlug(slug: string): Promise<AdminEmpowerRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from('empower_modules').select('*').eq('slug', slug).maybeSingle();
  return (data as AdminEmpowerRow) ?? null;
}

export async function listSiteContents(): Promise<AdminSiteContentRow[]> {
  return listAll<AdminSiteContentRow>('site_contents', [
    { column: 'section', ascending: true },
    { column: 'sort_order', ascending: true },
  ]);
}

export async function getSiteContentById(id: number): Promise<AdminSiteContentRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data } = await sb.from('site_contents').select('*').eq('id', id).maybeSingle();
  return (data as AdminSiteContentRow) ?? null;
}

export async function listMediaAssets(): Promise<AdminMediaRow[]> {
  return listAll<AdminMediaRow>('media_assets', [{ column: 'created_at', ascending: false }]);
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
