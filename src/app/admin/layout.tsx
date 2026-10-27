import AdminChrome from '@/components/admin/shell/AdminChrome';
import { getAdminSession } from '@/lib/admin/auth';

/**
 * /admin 的持久 App Shell 层。
 *
 * 会话在此取一次（服务端），只把可序列化字段（displayName/username/via）传给
 * 客户端壳 AdminChrome —— 侧栏 / 顶栏 / shader 背景在页面间导航时保持挂载。
 *
 * 这里**不做**未登录重定向：各页面的 isAdminAuthed 兜底不变；若在此跳转，
 * 会和登录页的「已登录则跳回 /admin」形成回路。
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  return (
    <AdminChrome
      session={
        session
          ? { displayName: session.displayName, username: session.username, via: session.via }
          : null
      }
    >
      {children}
    </AdminChrome>
  );
}
