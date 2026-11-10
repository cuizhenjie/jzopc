-- ═══════════════════════════════════════════════════════════════════════════
-- 集智 AI OPC 社区 · 补执行迁移汇总（2026-11-10）
--
-- 用途：生产库核验发现 3 处迁移未生效，本文件按序补执行：
--   ① 0009_leads_form_payload.sql        —— 【最紧急】供需表单结构化数据入库依赖
--   ② 0006_drop_site_contents.sql        —— 下线无消费方的 site_contents 空表
--   ③ 0005 的 site_stats 种子            —— 首页指标数字
--
-- 执行前必读（项目纪律，docs/02-技术方案.md §迁移）：
--   1. 先备份生产库（Supabase 控制台 → Database → Backups，或 pg_dump）；
--   2. 建议在 staging 完整执行一遍本文件，确认无报错再到生产执行；
--   3. 执行方式任选其一：
--      - Supabase 控制台 → SQL Editor → 整文件粘贴执行；
--      - psql 直连：psql "<postgres-connection-string>" -f 本文件；
--      - supabase CLI 登录后执行。
--
-- 执行后验证：node scripts/check-migrations-applied.mjs
--   预期输出「全部迁移均已生效」，共 20 项 ✔。
--
-- 顺序说明：0009 放最前 —— 应用代码已包含 form_payload 写入逻辑，
-- 列不存在期间 /api/leads 的所有提交都会失败，先补列先恢复。
-- 全部语句均为幂等（IF NOT EXISTS / ON CONFLICT DO NOTHING / IF EXISTS），
-- 重复执行不会产生副作用，可以整文件反复跑。
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ① 0009：leads 表新增 form_payload 列 ─────────────────────────────────
-- 背景：/market 前台「发布需求 / 发布能力」表单提交后进入线索池
-- （lead_type='market'，message 为格式化发布文案）。供需数据页（/admin/market）
-- 需要按表单字段结构化展示这两条表单的数据，而不是从文案文本里反解。
--
-- form_payload 保存表单原始取值（JSON 对象，结构见 src/lib/opc/form-payload.ts
-- 的 MarketFormValues + kind），仅供需发布表单会写入；其它 leadType 为 null。
-- 旧数据（2026-11-10 前入库的 market 线索）该列为 null，后台展示回退为
-- message 原文，不影响可读性。

alter table leads add column if not exists form_payload jsonb;


-- ── ② 0006：下线 site_contents ────────────────────────────────────────────
-- 背景：该表自 0001 建表起始终没有前台消费方，后台菜单长期展示空表造成
-- 「维护了却不生效」的误解。管理后台的对应路由 / API / 导航项已随本次
-- 迁移一并移除。核验时该表为 0 行，直接 DROP；策略随表级联删除。

drop table if exists site_contents;


-- ── ③ 0005 的 site_stats 种子（首页统计数字）────────────────────────────
-- 背景：0005 的 agent_categories / empower_modules 种子已灌入，但
-- site_stats 为 0 行（首页指标数字区块读不到数据）。此处摘出 0005 原文，
-- on conflict do nothing 保证已存在的 key 不被覆盖。

insert into site_stats (key, value, suffix, label, sort_order)
values
('agents',   500,  '+', '入驻智能体',   1),
('creators', 1000, '+', '活跃创业者',   2),
('courses',  100,  '+', '精品课程',     3),
('partners', 50,   '+', '生态伙伴企业', 4)
on conflict (key) do nothing;


-- ── 执行后自检：任一行报 [FAIL] 即本次执行不完整 ─────────────────────────

do $$
declare
  n_stats int;
  has_payload int;
begin
  select count(*) into n_stats from site_stats;
  if n_stats < 4 then
    raise exception '[FAIL] site_stats 种子不足（% 条）', n_stats;
  end if;
  select count(*) into has_payload
    from information_schema.columns
   where table_schema = 'public' and table_name = 'leads' and column_name = 'form_payload';
  if has_payload = 0 then
    raise exception '[FAIL] leads.form_payload 列不存在';
  end if;
  if to_regclass('public.site_contents') is not null then
    raise exception '[FAIL] site_contents 未删除';
  end if;
  raise notice '[OK] site_stats % 条 / form_payload 列已加 / site_contents 已删', n_stats;
end $$;
