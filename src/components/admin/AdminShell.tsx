import AdminPageHeader from './shell/AdminPageHeader';
import type { NavKey } from './shell/admin-nav';

export type { NavKey };

/**
 * 管理后台页面头（2026-10 App Shell 拆分后的瘦身版）。
 *
 * 拆分：layout 级 AdminChrome（src/app/admin/layout.tsx + shell/ 目录）持久渲染
 * 侧栏 / 顶栏 / shader 背景 —— 跨页面导航不重挂载，WebGL canvas 不重建；
 * 本组件只负责当前页的标题区（子页返回链接 / 强调条 / 标题 / 操作区）。
 *
 * props 与旧版完全一致（active/title/desc/actions/dbConfigured），
 * 既有 32 个页面无需任何改动。不再渲染 <main>（SiteChrome 已提供全文档
 * 唯一的 main）与顶栏/侧栏（已上移到 AdminChrome）。
 */
export default function AdminShell({
  active,
  title,
  desc,
  actions,
  dbConfigured = true,
  children,
}: {
  active: NavKey;
  title: string;
  desc?: string;
  /** 标题右侧的操作区（如「新建」「导出」按钮）。 */
  actions?: React.ReactNode;
  dbConfigured?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <AdminPageHeader navKey={active} title={title} desc={desc} actions={actions} dbConfigured={dbConfigured} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
