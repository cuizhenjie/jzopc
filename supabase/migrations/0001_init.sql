-- 集智 AI OPC 社区 · 初始化表结构
-- 目标：Supabase Postgres 15+
-- 约定：所有时间戳用 timestamptz；列表排序字段显式建索引；updated_at 用 trigger 维护。

-- ── 通用内容 ───────────────────────────────────────────────────────────────
create table if not exists site_contents (
  id          bigserial primary key,
  section     text not null,
  slug        text not null,
  title       text not null,
  subtitle    text,
  body_md     text,
  meta        jsonb not null default '{}'::jsonb,
  sort_order  int not null default 0,
  published   boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (section, slug)
);

-- ── 八大赋能模块 ───────────────────────────────────────────────────────────
create table if not exists empower_modules (
  slug        text primary key,
  index_no    text not null,
  title       text not null,
  tagline     text not null,
  hero_desc   text,
  body_md     text,
  values      jsonb not null default '[]'::jsonb,
  items       jsonb not null default '[]'::jsonb,
  highlights  jsonb not null default '[]'::jsonb,
  lead_type   text,
  pending     text,
  related     text[] not null default '{}',
  sort_order  int not null default 0,
  published   boolean not null default false,
  updated_at  timestamptz not null default now()
);

-- ── 首页指标 ───────────────────────────────────────────────────────────────
create table if not exists site_stats (
  key        text primary key,
  value      int not null,
  suffix     text not null default '+',
  label      text not null,
  sort_order int not null default 0
);

-- ── 智能体 ─────────────────────────────────────────────────────────────────
create table if not exists agent_categories (
  slug       text primary key,
  name       text not null,
  sort_order int not null default 0
);

create table if not exists agents (
  id           bigserial primary key,
  slug         text not null unique,
  name         text not null,
  category     text not null references agent_categories(slug),
  summary      text not null,
  description  text,
  icon_url     text,
  cover_url    text,
  tags         text[] not null default '{}',
  external_url text not null,
  provider     text,
  featured     boolean not null default false,
  sort_order   int not null default 0,
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists agents_list_idx on agents (category, published, sort_order);

-- ── 供需市场 ───────────────────────────────────────────────────────────────
create table if not exists market_items (
  id           bigserial primary key,
  slug         text not null unique,
  type         text not null check (type in ('demand','supply')),
  title        text not null,
  category     text not null,
  summary      text not null,
  -- 正文段落数组（与 src/lib/data/seed.ts 的 body: string[] 同形）
  body         jsonb not null default '[]'::jsonb,
  org_name     text,
  tags         text[] not null default '{}',
  contact_hint text,
  status       text not null default 'open' check (status in ('open','matched','closed')),
  published_at timestamptz,
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists market_list_idx on market_items (type, category, published_at desc);

-- ── 课程 ───────────────────────────────────────────────────────────────────
create table if not exists courses (
  id         bigserial primary key,
  slug       text not null unique,
  track      text not null,
  title      text not null,
  summary    text not null,
  -- 正文段落数组（与 src/lib/data/seed.ts 的 body: string[] 同形）
  body       jsonb not null default '[]'::jsonb,
  tags       text[] not null default '{}',
  cover_url  text,
  mentor     text,
  sort_order int not null default 0,
  published  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── 社区动态 ───────────────────────────────────────────────────────────────
create table if not exists news_posts (
  id           bigserial primary key,
  slug         text not null unique,
  title        text not null,
  summary      text not null,
  -- 正文段落数组（与 src/lib/data/seed.ts 的 body: string[] 同形）
  body         jsonb not null default '[]'::jsonb,
  cover_url    text,
  category     text not null,
  author       text,
  status       text not null default 'published' check (status in ('draft','published','archived')),
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists news_list_idx on news_posts (category, status, published_at desc);

-- ── 合作企业 ───────────────────────────────────────────────────────────────
create table if not exists partners (
  id         bigserial primary key,
  name       text not null,
  logo_url   text,
  website    text,
  group_name text,
  sort_order int not null default 0,
  published  boolean not null default false
);

-- ── 线索 ───────────────────────────────────────────────────────────────────
create table if not exists leads (
  id             bigserial primary key,
  lead_type      text not null,
  name           text not null,
  contact_type   text not null check (contact_type in ('phone','email')),
  contact        text not null,
  org_name       text,
  role           text,
  subject_type   text,
  team_size      int,
  track          text,
  message        text,
  source_page    text not null,
  source_ref     text,
  utm            jsonb not null default '{}'::jsonb,
  status         text not null default 'new' check (status in ('new','contacting','converted','invalid')),
  note           text,
  idempotency_key text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists leads_type_status_idx on leads (lead_type, status);
create index if not exists leads_created_idx on leads (created_at desc);
-- 部分唯一索引：空值不互相冲突
create unique index if not exists leads_idempotency_idx
  on leads (idempotency_key) where idempotency_key is not null;

-- ── 媒体资源 ───────────────────────────────────────────────────────────────
create table if not exists media_assets (
  id         bigserial primary key,
  path       text not null,
  url        text not null,
  kind       text not null,
  alt        text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

-- ── updated_at 自动维护 ────────────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'site_contents','empower_modules','agents','market_items','courses','news_posts','leads'
  ] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$I', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$I
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
