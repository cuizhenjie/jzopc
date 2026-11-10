-- 集智 AI OPC 社区 · leads 表新增 form_payload 列
--
-- 背景：/market 前台「发布需求 / 发布能力」两张表单提交后进入线索池
-- （lead_type='market'，message 为格式化发布文案）。供需数据页（/admin/market）
-- 需要按表单字段结构化展示这两条表单的数据，而不是从文案文本里反解。
--
-- form_payload 保存表单原始取值（JSON 对象，结构见 src/lib/opc/form-payload.ts
-- 的 MarketFormValues + kind），仅供需发布表单会写入；其它 leadType 为 null。
-- 旧数据（2026-11-10 前入库的 market 线索）该列为 null，后台展示回退为
-- message 原文，不影响可读性。

alter table leads add column if not exists form_payload jsonb;
