-- 首页首屏 banner。
-- 后台「首页 Banner」维护；前台按 sort_order 升序轮播，并带底部步骤条与左右切换。
-- published = false 的行对 anon 不可见。

create table if not exists home_banners (
  id          bigserial primary key,
  image_url   text not null,
  alt         text not null default '',
  sort_order  int not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists home_banners_list_idx on home_banners (published, sort_order, id);

drop trigger if exists trg_touch_home_banners on public.home_banners;
create trigger trg_touch_home_banners
  before update on public.home_banners
  for each row execute function public.touch_updated_at();

-- 把现在写死在首屏里的两张图种进来。表里已有数据就整段跳过，不覆盖运营后续修改。
insert into home_banners (image_url, alt, sort_order, published)
select v.image_url, v.alt, v.sort_order, v.published
from (
  values
    ('/opc/reference/img/hero-banner-2.jpg'::text, '2026 OPC 创新发展大会会场全景'::text, 0, true),
    ('/opc/reference/img/hero-banner-1.jpg'::text, '2026 OPC 创新发展大会现场'::text, 1, true)
) as v(image_url, alt, sort_order, published)
where not exists (select 1 from home_banners);

-- 0002 的 grant all on all tables 是时点授权，覆盖不到本迁移新建的表。
grant select on home_banners to anon, authenticated;
grant all on home_banners to service_role;
grant usage, select on sequence home_banners_id_seq to service_role;

alter table home_banners enable row level security;

drop policy if exists "public read home_banners" on home_banners;
create policy "public read home_banners" on home_banners
  for select using (published = true);
