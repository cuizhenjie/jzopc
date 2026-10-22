-- 集智 AI OPC 社区 · 管理后台账号表
--
-- 目的：把 /admin 的登录从「单一环境变量口令（OPS_TOKEN）」升级为
-- 「管理员账号（用户名 + 密码）」，兑现 README 技术债 R1 的账号体系部分。
--
-- 安全约定（与 leads 表同款）：
--   1. RLS 开启且**不创建任何 anon / authenticated 策略** → 浏览器直连
--      连 select 都不行；唯一读写路径是服务端 service_role。
--   2. 密码**绝不入库明文**：password_hash 存 node:crypto scrypt 派生键，
--      格式 `scrypt:<saltHex>:<hashHex>`（见 src/lib/admin/accounts.ts），
--      建号/改密走 scripts/create-admin.mjs。
--   3. OPS_TOKEN 保留为「恢复主口令」通道（忘了密码 / 无可用账号时兜底），
--      可在环境变量里清空以彻底关闭该通道。

create table if not exists admin_users (
  id            bigserial primary key,
  username      text not null unique,
  display_name  text not null,
  password_hash text not null,
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists admin_users_username_idx on admin_users (username) where is_active;

-- updated_at 触发器（与 0001_init.sql 的 touch_updated_at 同一函数）
drop trigger if exists trg_touch_admin_users on admin_users;
create trigger trg_touch_admin_users before update on admin_users
  for each row execute function public.touch_updated_at();

-- ── RLS：零策略，仅 service_role 可读写（同 leads）───────────────────────
alter table admin_users enable row level security;
-- 刻意不创建 anon / authenticated 策略：
-- 密码哈希属于高敏感数据，任何浏览器直连（含 select）都必须被拒。

-- ── service_role 授权 ─────────────────────────────────────────────────────
-- 0002 的 `grant all on all tables` 是时点授权，覆盖不到本迁移新建的表；
-- 不显式授予的话，干净库上 admin 后端（服务端 service_role 读写）会
-- 直接 permission denied（托管 Supabase 靠平台默认权限侥幸可用，不可依赖）。
grant all on admin_users to service_role;
grant usage, select on sequence admin_users_id_seq to service_role;
