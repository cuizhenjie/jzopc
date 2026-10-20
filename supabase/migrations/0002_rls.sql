-- 集智 AI OPC 社区 · RLS 策略
--
-- 关键约定：
-- 1. 公开内容表对 anon 只读（select）。
-- 2. `leads` 表**不创建任何 anon / authenticated 策略** → 浏览器直连写入必被拒；
--    唯一写入路径是服务端 Route Handler 用 service_role。
-- 3. 每张表的「可见性字段」不同，策略不能照抄：
--    site_stats / agent_categories 没有 published 列；
--    news_posts 用 status 而非 published。

-- ── 公开内容表：全部开启 RLS ─────────────────────────────────────────────
alter table site_contents    enable row level security;
alter table empower_modules  enable row level security;
alter table site_stats       enable row level security;
alter table agent_categories enable row level security;
alter table agents           enable row level security;
alter table market_items     enable row level security;
alter table courses          enable row level security;
alter table news_posts       enable row level security;
alter table partners         enable row level security;
alter table media_assets     enable row level security;

-- 有 published 布尔位的表
drop policy if exists "public read site_contents" on site_contents;
create policy "public read site_contents" on site_contents
  for select using (published = true);

drop policy if exists "public read empower_modules" on empower_modules;
create policy "public read empower_modules" on empower_modules
  for select using (published = true);

drop policy if exists "public read agents" on agents;
create policy "public read agents" on agents
  for select using (published = true);

drop policy if exists "public read market_items" on market_items;
create policy "public read market_items" on market_items
  for select using (published = true);

drop policy if exists "public read courses" on courses;
create policy "public read courses" on courses
  for select using (published = true);

drop policy if exists "public read partners" on partners;
create policy "public read partners" on partners
  for select using (published = true);

-- news_posts 用 status
drop policy if exists "public read news_posts" on news_posts;
create policy "public read news_posts" on news_posts
  for select using (status = 'published');

-- site_stats 与 agent_categories 没有发布位
drop policy if exists "public read site_stats" on site_stats;
create policy "public read site_stats" on site_stats
  for select using (true);

drop policy if exists "public read agent_categories" on agent_categories;
create policy "public read agent_categories" on agent_categories
  for select using (true);

drop policy if exists "public read media_assets" on media_assets;
create policy "public read media_assets" on media_assets
  for select using (true);

-- ── 线索表：不开任何 anon 策略 ────────────────────────────────────────────
alter table leads enable row level security;
-- 不创建 anon / authenticated 的 insert / select / update 策略
-- → PostgREST 直连一律被拒（403 / 425）
-- → 只有 service_role（服务端 SDK）可读写
--
-- 冒烟验证（部署后在生产库跑一次，预期报错）：
--   insert into leads (lead_type,name,contact_type,contact,source_page)
--   values ('apply','测试','phone','13800000000','/test');
--   -- 预期：new row violates row-level security policy
