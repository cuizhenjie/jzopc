-- 集智 AI OPC 社区 · 迁移 0003：正文字段统一为 body jsonb
--
-- 背景（2026-10-20 在真实 PostgreSQL 上实测发现）：
--   迁移 0001 把三张表的正文列定义成 `body_md text`，但应用侧的类型是
--   `body: string[]`（段落数组），页面直接执行 `post.body.map(...)`。
--   接真库时 `post.body` 恒为 undefined → **新闻详情页会直接抛错**。
--   本地因为有「未配置 Supabase → 回落到种子数据」的兜底，这个错配被完全掩盖，
--   只有在真实 PostgreSQL 上执行迁移才能暴露。
--
-- 修复：把 `body_md text` 统一改为 `body jsonb not null default '[]'::jsonb`，
--   与应用类型同形。0001 已同步修改（首次部署即拿到正确结构），
--   本迁移负责**已执行过 0001 的库**的升级路径，幂等可重复执行。
--
-- 已知取舍：`site_contents.body_md` 与 `empower_modules.body_md` 保持不变 ——
--   那是 CMS 可编辑文本块的 markdown 字段，语义与应用层的段落数组不同。

-- 1) 新增 body 列（若尚不存在）
alter table news_posts  add column if not exists body jsonb not null default '[]'::jsonb;
alter table market_items add column if not exists body jsonb not null default '[]'::jsonb;
alter table courses      add column if not exists body jsonb not null default '[]'::jsonb;

-- 2) 从旧的 body_md 迁移数据：按空行切成段落数组；然后删掉旧列
do $$
declare
  t text;
begin
  foreach t in array array['news_posts', 'market_items', 'courses'] loop
    if exists (
      select 1 from information_schema.columns
       where table_schema = 'public' and table_name = t and column_name = 'body_md'
    ) then
      -- body_md 形如 "第一段\n\n第二段" → ["第一段","第二段"]
      execute format(
        'update %I set body = coalesce(to_jsonb(string_to_array(body_md, E''\n\n'')), ''[]''::jsonb)
          where body_md is not null and body_md <> '''' and body = ''[]''::jsonb',
        t);
      execute format('alter table %I drop column body_md', t);
    end if;
  end loop;
end $$;

-- 3) 校验：body 必须是数组（防止手写进非数组值）
do $$
declare
  t text;
  bad int;
begin
  foreach t in array array['news_posts', 'market_items', 'courses'] loop
    execute format('select count(*) from %I where jsonb_typeof(body) <> ''array''', t) into bad;
    if bad > 0 then
      raise exception '[FAIL] %.body 存在非数组值（% 行）', t, bad;
    end if;
  end loop;
  raise notice '[OK] news_posts / market_items / courses 的 body 均为 jsonb 数组';
end $$;
