import { redirect } from 'next/navigation';

/**
 * 旧线索看板已升级为完整管理后台（/admin），此路由仅做迁移跳转。
 * /admin/leads 自带认证检查：已登录直接进列表，未登录自动转 /admin/login。
 * 旧的 ?token= 地址栏口令流程已停用（口令不再进 URL，改为登录页 + httpOnly cookie）。
 */
export default function OpsLeadsRedirectPage() {
  redirect('/admin/leads');
}
