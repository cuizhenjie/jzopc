-- 2026-11-10 地址口径统一：全部地址文案改为
-- 「北京市丰台区集美家居大红门店3号厅2层 集智OPC社区」。
-- 0005 种子已同步修正；本迁移把已灌库的 empower_modules 存量行刷成新地址
-- （empower 详情页运行时 DB 优先读取，不刷的话旧地址会覆盖内置新文案）。

update empower_modules
set hero_desc = replace(hero_desc, '北京丰台大红门', '北京市丰台区集美家居大红门店3号厅2层 集智OPC社区')
where hero_desc like '%北京丰台大红门%';

update empower_modules
set highlights = replace(highlights::text, '丰台 · 大红门', '北京市丰台区集美家居大红门店3号厅2层 集智OPC社区')::jsonb
where highlights::text like '%丰台 · 大红门%';
