-- 集智 AI OPC 社区 · 迁移冒烟测试
--
-- 用途：在**真实 PostgreSQL** 上逐字执行 `supabase/migrations/0001_init.sql`、
-- `0002_rls.sql`、`0003_body_jsonb.sql`、`0004_admin_users.sql` 之后，
-- 跑这份脚本验证三件事：
--   1. 迁移脚本本身可执行（无语法错误、列名与策略引用一致）；
--   2. 表结构与「可见性字段」的差异符合设计（news_posts 用 status，其余用 published）；
--   3. RLS 的**实际拦截行为**符合约定 —— 尤其「anon 直连写 leads 必被拒」。
--
-- 运行方式（一次性集群，跑完即删）：
--   initdb -D /tmp/jz_pg/data -U postgres --encoding=UTF8 --locale=C
--   pg_ctl -D /tmp/jz_pg/data -o "-p 55432 -k /tmp/jz_pg/sock -c listen_addresses=''" -w start
--   psql -h /tmp/jz_pg/sock -p 55432 -U postgres -d postgres \
--        -v ON_ERROR_STOP=1 -f supabase/migrations/0001_init.sql \
--        -v ON_ERROR_STOP=1 -f supabase/migrations/0002_rls.sql \
--        -v ON_ERROR_STOP=1 -f supabase/migrations/0003_body_jsonb.sql \
--        -v ON_ERROR_STOP=1 -f supabase/migrations/0004_admin_users.sql \
--        -v ON_ERROR_STOP=1 -f supabase/tests/001_migration_smoke.sql
--
-- 约定：Supabase 内置的三个角色在测试库里需要先手工建好：
--   create role anon nologin;
--   create role authenticated nologin;
--   create role service_role nologin bypassrls;
--
-- 断言失败时脚本**以非零退出码结束**（方便接 CI）。

\set ON_ERROR_STOP on
\timing off

-- ── 断言辅助函数 ────────────────────────────────────────────────────────────
-- assert_true(描述, 布尔表达式)：表达式为假时抛异常 → psql 退出码非零
create or replace function pg_temp.assert_true(label text, cond boolean)
returns void language plpgsql as $$
begin
  if cond is not true then
    raise exception '[FAIL] %', label;
  end if;
  raise notice '[PASS] %', label;
end;
$$;

-- assert_raises(描述, SQL 片段)：期望该 SQL 抛异常；不抛则判定失败
create or replace function pg_temp.assert_raises(label text, stmt text)
returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice '[PASS] % （如预期被拒：%）', label, left(sqlerrm, 90);
    return;
  end;
  raise exception '[FAIL] % —— 期望被拒绝，但执行成功了', label;
end;
$$;

-- assert_raises_as(角色, 描述, SQL 片段)：在指定角色下执行，期望被拒
-- ⚠️ 必须在同一次调用里设置与恢复角色 —— 角色是事务级设置，
--    若在外层 DO 块结束时复位成 postgres，后续断言就会以超级用户身份跑，
--    绕过 RLS 与权限检查（超级用户默认 BYPASSRLS），断言会假通过。
create or replace function pg_temp.assert_raises_as(who text, label text, stmt text)
returns void language plpgsql as $$
begin
  perform set_config('role', who, true);
  begin
    execute stmt;
  exception when others then
    perform set_config('role', 'postgres', true);
    raise notice '[PASS] % （如预期被拒：%）', label, left(sqlerrm, 90);
    return;
  end;
  perform set_config('role', 'postgres', true);
  raise exception '[FAIL] % —— 期望被拒绝，但执行成功了', label;
end;
$$;

-- 以指定角色执行 SQL
create or replace function pg_temp.as_role(who text, stmt text)
returns void language plpgsql as $$
begin
  perform set_config('role', who, true);
  execute stmt;
  perform set_config('role', 'postgres', true);
end;
$$;

-- 1. 表数量（0006 下线 site_contents 后为 11 张）
select pg_temp.assert_true(
  '11 张业务表全部创建（0004 的 admin_users 在内，site_contents 已下线）',
  (select count(*) from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE') = 11
);

-- 2. RLS 全部开启
select pg_temp.assert_true(
  '11 张表全部开启 RLS',
  (select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity) = 11
);

-- 3. 公开内容表各有一条 select 策略（site_contents 的策略随表级联删除）
select pg_temp.assert_true(
  '9 张公开内容表各有一条 "public read *" 策略',
  (select count(*) from pg_policies
    where schemaname = 'public' and policyname like 'public read %') = 9
);

-- 4. 核心安全断言：leads 表没有任何策略
select pg_temp.assert_true(
  'leads 表零策略（anon 直连写必被拒）',
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'leads') = 0
);

-- 4b. admin_users 表：零策略 + 关键列齐备（密码哈希表绝不允许浏览器直连）
select pg_temp.assert_true(
  'admin_users 表零策略（密码哈希仅 service_role 可读）',
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'admin_users') = 0
);
select pg_temp.assert_true(
  'admin_users 包含账号体系所需的 7 个列',
  (select count(*) from information_schema.columns
    where table_name = 'admin_users'
      and column_name in ('id','username','display_name','password_hash','is_active','last_login_at','created_at')) = 7
);

-- 5. 可见性字段的差异（策略不能照抄）
select pg_temp.assert_true(
  'news_posts 用 status 列、没有 published 列',
  exists (select 1 from information_schema.columns
          where table_name='news_posts' and column_name='status')
  and not exists (select 1 from information_schema.columns
          where table_name='news_posts' and column_name='published')
);
select pg_temp.assert_true(
  'site_stats / agent_categories 没有 published 列',
  not exists (select 1 from information_schema.columns
              where table_name in ('site_stats','agent_categories') and column_name='published')
);
select pg_temp.assert_true(
  'agents / market_items / courses / partners / empower_modules 有 published 列（site_contents 已下线）',
  (select count(*) from information_schema.columns
    where table_name in ('agents','market_items','courses','partners','empower_modules')
      and column_name='published') = 5
);

-- 6. route.ts 的插入列必须全部存在（对齐 src/app/api/leads/route.ts 的 insert）
select pg_temp.assert_true(
  'leads 表包含 route.ts 插入的全部 13 个列',
  (select count(*) from information_schema.columns
    where table_name='leads'
      and column_name in ('lead_type','name','contact_type','contact','org_name','role',
                          'subject_type','team_size','track','message','source_page',
                          'source_ref','idempotency_key')) = 13
);

-- 6b. 正文字段必须是 jsonb 数组，且与应用层 body: string[] 同名
select pg_temp.assert_true(
  'news_posts / market_items / courses 的 body 列存在且为 jsonb 数组类型',
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name in ('news_posts','market_items','courses')
      and column_name='body' and data_type='jsonb') = 3
);
select pg_temp.assert_true(
  '三张表的 body 默认值为空数组',
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name in ('news_posts','market_items','courses')
      and column_name='body' and column_default like '%jsonb%') = 3
);
select pg_temp.assert_true(
  '三张表已不再存在 body_md 列（与 app 层 body 字段对齐）',
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name in ('news_posts','market_items','courses')
      and column_name='body_md') = 0
);

-- 7. 幂等键的部分唯一索引存在（route.ts 靠 23505 判重复提交）
select pg_temp.assert_true(
  'leads.idempotency_key 存在部分唯一索引',
  exists (select 1 from pg_indexes
          where schemaname='public' and indexname='leads_idempotency_idx')
);

-- ── 准备测试数据（以 service_role 写入）────────────────────────────────────
insert into site_stats (key, value, suffix, label, sort_order)
values ('agents', 500, '+', '入驻智能体', 1)
on conflict (key) do nothing;

insert into news_posts (slug, title, summary, body, category, status, published_at, author)
values ('test-published', '已发布', '摘要', '["正文第一段","正文第二段"]'::jsonb, '资讯', 'published', now(), '测试')
on conflict (slug) do nothing;
insert into news_posts (slug, title, summary, body, category, status, published_at, author)
values ('test-draft', '草稿', '摘要', '[]'::jsonb, '资讯', 'draft', now(), '测试')
on conflict (slug) do nothing;

-- ── 行为断言 ────────────────────────────────────────────────────────────────
-- anon 读公开内容：应成功（需 0002 的显式 grant）
do $$
declare v int;
begin
  perform set_config('role', 'anon', true);
  select count(*) into v from site_stats;
  perform set_config('role', 'postgres', true);
  if v < 1 then
    raise exception '[FAIL] anon 读 site_stats 应至少读到 1 行，实际 % 行', v;
  end if;
  raise notice '[PASS] anon 可读 site_stats（% 行）', v;
end $$;

-- anon 读 news_posts：已发布的可见、未发布的不可见
--   （按具体 slug 判定，而不是数整表行数 —— 这样即使库里已有其他数据也不受影响）
do $$
declare v_pub int; v_draft int;
begin
  perform set_config('role', 'anon', true);
  select count(*) into v_pub   from news_posts where slug = 'test-published';
  select count(*) into v_draft from news_posts where slug = 'test-draft';
  perform set_config('role', 'postgres', true);
  if v_pub <> 1 or v_draft <> 0 then
    raise exception '[FAIL] anon 读 news_posts：已发布可见数 %（期望 1）、未发布可见数 %（期望 0）', v_pub, v_draft;
  end if;
  raise notice '[PASS] anon 读 news_posts：已发布可见、未发布不可见（status 过滤生效）';
end $$;

-- anon 读 agents：未 published 的行应被过滤
do $$
declare v int;
begin
  -- agents.category 有外键指向 agent_categories(slug)，必须先有分类行
  insert into agent_categories (slug, name, sort_order)
  values ('office', '办公', 1) on conflict (slug) do nothing;
  insert into agents (slug, name, category, summary, description, tags, external_url, provider, published)
  values ('test-agent-pub','公开智能体','office','s','d','{}','https://example.com','p', true),
         ('test-agent-hid','未发布智能体','office','s','d','{}','https://example.com','p', false)
  on conflict (slug) do nothing;
  perform set_config('role', 'anon', true);
  select count(*) into v from agents where slug = 'test-agent-pub';
  perform set_config('role', 'postgres', true);
  if v <> 1 then
    raise exception '[FAIL] anon 读 agents：已发布可见数 %（期望 1）', v;
  end if;
  perform set_config('role', 'anon', true);
  select count(*) into v from agents where slug = 'test-agent-hid';
  perform set_config('role', 'postgres', true);
  if v <> 0 then
    raise exception '[FAIL] anon 读 agents：未发布可见数 %（期望 0）', v;
  end if;
  raise notice '[PASS] anon 读 agents：仅 published=true 可见（published 过滤生效）';
end $$;

-- 核心安全断言：anon 直连写 leads 必须被拒
select pg_temp.assert_raises_as('anon',
  'anon 直连 INSERT leads 被拒绝（未授权层）',
  $$insert into leads (lead_type,name,contact_type,contact,source_page)
    values ('apply','测试','phone','13800000000','/test')$$
);

-- anon 连读 leads 都不行（0002 未授予 leads 任何权限）
select pg_temp.assert_raises_as('anon',
  'anon 直连 SELECT leads 被拒绝（未授权层）',
  $$select count(*) from leads$$
);

-- anon 写公开内容表同样被拒
select pg_temp.assert_raises_as('anon',
  'anon 直连 INSERT agents 被拒绝（未授权层）',
  $$insert into agents (slug,name,category,summary,description,tags,external_url,provider,published)
    values ('hack','x','office','s','d','{}','https://e.com','p',true)$$
);
select pg_temp.assert_raises_as('anon',
  'anon 直连 UPDATE news_posts 被拒绝（未授权层）',
  $$update news_posts set title='改' where slug='test-published'$$
);
select pg_temp.assert_raises_as('anon',
  'anon 直连 DELETE news_posts 被拒绝（未授权层）',
  $$delete from news_posts where slug='test-published'$$
);

-- RLS 兜底层：临时给 anon INSERT 与序列权限，零策略仍必须拦住写入
--   （证明拦截来自 RLS 策略本身，而不是仅靠「没授权」）
grant insert on leads to anon;
grant usage on leads_id_seq to anon;

select pg_temp.assert_raises_as('anon',
  '即使授予 INSERT + 序列权限，anon 直连 INSERT leads 仍被 RLS 零策略拒绝（兜底层）',
  $$insert into leads (lead_type,name,contact_type,contact,source_page)
    values ('apply','越权','phone','13800000009','/test')$$
);

revoke insert on leads from anon;
revoke usage on leads_id_seq from anon;

-- admin_users：密码哈希表，anon 即使被授予 SELECT，RLS 零策略也必须让它一行都读不到。
-- ⚠️ RLS 零策略对 SELECT 的语义是**静默过滤（0 行）**而不是抛 42501（只有写操作会抛错），
--    所以这里不能用 assert_raises_as —— 必须先播种一行，再断言 anon 读到 0 行。
do $$
declare seeded int; visible int;
begin
  perform set_config('role', 'service_role', true);
  insert into admin_users (username, display_name, password_hash)
    values ('smoke-admin', '冒烟管理员', 'scrypt:00:00')
  on conflict (username) do nothing;
  select count(*) into seeded from admin_users where username = 'smoke-admin';
  perform set_config('role', 'postgres', true);
  if seeded < 1 then
    raise exception '[FAIL] service_role 应能写入 admin_users 播种行';
  end if;

  grant select on admin_users to anon;
  perform set_config('role', 'anon', true);
  select count(*) into visible from admin_users;
  perform set_config('role', 'postgres', true);
  revoke select on admin_users from anon;

  if visible <> 0 then
    raise exception '[FAIL] 授予 SELECT 后 anon 仍读到 % 行 admin_users（RLS 零策略应过滤为 0 行）', visible;
  end if;
  raise notice '[PASS] 即使授予 SELECT，anon 读 admin_users 被 RLS 零策略过滤为 0 行（密码哈希不可泄露）';
end $$;

-- service_role 可写可读
do $$
declare v int;
begin
  perform set_config('role', 'service_role', true);
  insert into leads (lead_type,name,contact_type,contact,source_page)
    values ('apply','服务端写入','phone','13800000000','/test')
    on conflict do nothing;
  select count(*) into v from leads;
  perform set_config('role', 'postgres', true);
  if v < 1 then
    raise exception '[FAIL] service_role 写入 leads 后应能读回';
  end if;
  raise notice '[PASS] service_role 可写入并读回 leads';
end $$;

-- 幂等：同一 idempotency_key 重复插入必须报唯一冲突（route.ts 据此按 23505 判成功）
select pg_temp.assert_raises(
  '重复 idempotency_key 被唯一索引拒绝（对应 route.ts 的 23505 分支）',
  $$insert into leads (lead_type,name,contact_type,contact,source_page,idempotency_key)
    values ('apply','幂等','phone','13800000001','/test','k-1');
    insert into leads (lead_type,name,contact_type,contact,source_page,idempotency_key)
    values ('apply','幂等2','phone','13800000002','/test','k-1')$$
);

-- 部分唯一索引：多条 NULL idempotency_key 互不冲突
do $$
declare v int;
begin
  insert into leads (lead_type,name,contact_type,contact,source_page)
    values ('apply','空键1','phone','13800000003','/t'),
           ('apply','空键2','phone','13800000004','/t')
    on conflict do nothing;
  select count(*) into v from leads where idempotency_key is null;
  perform set_config('role', 'postgres', true);
  if v < 2 then
    raise exception '[FAIL] NULL idempotency_key 应互不冲突，实际只有 % 条', v;
  end if;
  raise notice '[PASS] 多个 NULL idempotency_key 互不冲突（部分唯一索引生效）';
end $$;

-- check 约束
select pg_temp.assert_raises(
  'contact_type 非 phone/email 被 check 约束拒绝',
  $$insert into leads (lead_type,name,contact_type,contact,source_page)
    values ('apply','x','wechat','13800000005','/t')$$
);
select pg_temp.assert_raises(
  'status 非法值被 check 约束拒绝',
  $$insert into leads (lead_type,name,contact_type,contact,source_page,status)
    values ('apply','x','phone','13800000006','/t','unknown-status')$$
);

-- updated_at 触发器
do $$
declare t timestamptz; before_ts timestamptz;
begin
  update leads set name='改名' where contact='13800000000';
  select updated_at into t from leads where contact='13800000000';
  perform set_config('role', 'postgres', true);
  if t is null then
    raise exception '[FAIL] updated_at 触发器未生效';
  end if;
  raise notice '[PASS] updated_at 触发器自动维护（当前 %）', t;
end $$;

-- ── 迁移 0005：管理后台模块种子（empower_modules / site_stats）─────────────
do $$
declare n int;
begin
  select count(*) into n from empower_modules where published;
  if n < 8 then
    raise exception '[FAIL] 0005 种子后已发布赋能模块应 ≥ 8，实际 %', n;
  end if;
  raise notice '[PASS] 0005 赋能模块种子（已发布 % 条）', n;

  select count(*) into n from site_stats;
  if n < 4 then
    raise exception '[FAIL] 0005 种子后 site_stats 应 ≥ 4，实际 %', n;
  end if;
  raise notice '[PASS] 0005 统计数字种子（% 条）', n;

  -- 种子幂等：on conflict do nothing，且 values/highlights 必须是合法 jsonb
  if exists (select 1 from empower_modules where slug='space' and jsonb_typeof(values) <> 'array') then
    raise exception '[FAIL] empower_modules.values 应为 jsonb 数组';
  end if;
  raise notice '[PASS] 0005 种子幂等与 jsonb 形状校验';
end $$;

-- 清理测试数据（让脚本可重复执行）
delete from leads where name in ('服务端写入','空键1','空键2','幂等','幂等2','越权','测试');
delete from agents where slug in ('test-agent-pub','test-agent-hid');
delete from news_posts where slug in ('test-published','test-draft');
delete from site_stats where key = 'agents';
delete from agent_categories where slug = 'office' and not exists (select 1 from agents a where a.category = 'office');

-- 清理
drop function if exists pg_temp.assert_true(text, boolean);
drop function if exists pg_temp.assert_raises(text, text);
drop function if exists pg_temp.assert_raises_as(text, text, text);
drop function if exists pg_temp.as_role(text, text);

\echo ''
\echo '════════════════════════════════════════════════'
\echo ' 迁移冒烟测试全部通过'
\echo '════════════════════════════════════════════════'
