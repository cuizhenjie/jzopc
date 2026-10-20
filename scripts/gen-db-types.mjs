#!/usr/bin/env node
/**
 * 从 `supabase/migrations/0001_init.sql` 生成 `@supabase/supabase-js` 的 `Database` 类型。
 *
 * 特性：
 * - 零依赖、纯正则/行解析，不连数据库；
 * - 解析表名、列名、列类型、是否可空、是否有默认值、主键与外键；
 * - 输出稳定、幂等：同样的 SQL 反复执行产出完全一致的文件。
 *
 * 用法：node scripts/gen-db-types.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SQL_PATH = resolve(repoRoot, 'supabase/migrations/0001_init.sql');
const OUT_PATH = resolve(repoRoot, 'src/lib/supabase/database.types.ts');

/* ── SQL 类型 → TypeScript 类型 ─────────────────────────────────────────── */

const TYPE_MAP = {
  bigserial: 'number', serial: 'number', bigint: 'number', int: 'number',
  integer: 'number', smallint: 'number', numeric: 'number', decimal: 'number',
  real: 'number', double: 'number', money: 'number',
  text: 'string', varchar: 'string', char: 'string', uuid: 'string',
  citext: 'string', name: 'string', inet: 'string',
  boolean: 'boolean', bool: 'boolean',
  jsonb: 'Json', json: 'Json',
  timestamptz: 'string', timestamp: 'string', date: 'string', time: 'string',
  interval: 'string',
};

/** SQL 类型 → TS 类型；未知类型保守回落为 unknown */
function tsType(sqlType) {
  const t = sqlType.toLowerCase();
  if (t.endsWith('[]')) return `${tsType(t.slice(0, -2))}[]`;
  return TYPE_MAP[t] ?? 'unknown';
}

/* ── SQL 解析 ──────────────────────────────────────────────────────────── */

/** 去掉行注释与块注释，避免注释里的关键字干扰解析 */
function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

/** 抽取所有 `create table` 语句体 */
function extractTables(sql) {
  const lines = stripComments(sql).split(/\r?\n/);
  const tables = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(
      /^\s*create\s+table\s+(?:if\s+not\s+exists\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*$/i,
    );
    if (!m) {
      i++;
      continue;
    }
    const name = m[1];
    const body = [];
    i++;
    while (i < lines.length && !/^\s*\)\s*;?\s*$/.test(lines[i])) {
      body.push(lines[i]);
      i++;
    }
    i++; // 跳过收尾的 `);`
    tables.push({ name, body });
  }
  return tables;
}

/** 表级约束（unique (...) / primary key (...) / check (...) / foreign key ...）不是列 */
const TABLE_CONSTRAINT_RE =
  /^\s*(unique|primary\s+key|foreign\s+key|check|constraint|exclude)\b/i;

/** 解析建表体 → 列定义数组 */
function parseColumns(body) {
  const columns = [];
  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    if (TABLE_CONSTRAINT_RE.test(line)) continue;

    // 去掉行尾逗号（check 表达式内部可能还有逗号，只去最后一个）
    const def = line.replace(/,\s*$/, '');
    const m = def.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+([A-Za-z_][A-Za-z0-9_]*(\[\])?)\s*(.*)$/);
    if (!m) continue;

    const [, colName, sqlType, , modifiers] = m;
    const isPrimaryKey = /\bprimary\s+key\b/i.test(modifiers);
    const notNull = /\bnot\s+null\b/i.test(modifiers) || isPrimaryKey;
    const hasDefault =
      /\bdefault\b/i.test(modifiers) || /^(bigserial|serial)$/i.test(sqlType);
    const unique = /\bunique\b/i.test(modifiers) || isPrimaryKey;

    const refMatch = modifiers.match(
      /\breferences\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)/i,
    );

    columns.push({
      name: colName,
      sqlType,
      tsType: tsType(sqlType),
      notNull,
      hasDefault,
      isPrimaryKey,
      unique,
      references: refMatch ? { table: refMatch[1], column: refMatch[2] } : null,
    });
  }
  return columns;
}

/* ── 类型文件生成 ──────────────────────────────────────────────────────── */

function renderRow(columns) {
  return columns
    .map((c) => `          ${c.name}: ${c.tsType}${c.notNull ? '' : ' | null'};`)
    .join('\n');
}

function renderInsert(columns) {
  return columns
    .map((c) => {
      const required = c.notNull && !c.hasDefault;
      const type = c.notNull ? c.tsType : `${c.tsType} | null`;
      return `          ${c.name}${required ? '' : '?'}: ${type};`;
    })
    .join('\n');
}

function renderUpdate(columns) {
  return columns
    .map((c) => `          ${c.name}?: ${c.notNull ? c.tsType : `${c.tsType} | null`};`)
    .join('\n');
}

function renderRelationships(tableName, columns) {
  return columns
    .filter((c) => c.references)
    .map((c) => {
      const { table, column } = c.references;
      return [
        '          {',
        `            foreignKeyName: "${tableName}_${c.name}_fkey",`,
        `            columns: ["${c.name}"],`,
        '            isOneToOne: false,',
        `            referencedRelation: "${table}",`,
        `            referencedColumns: ["${column}"],`,
        '          },',
      ].join('\n');
    });
}

function generate(tables) {
  const blocks = tables.map((table) => {
    const columns = table.columns;
    const rels = renderRelationships(table.name, columns);
    const relBlock = rels.length > 0 ? `[\n${rels.join('\n')}\n        ]` : '[]';
    return [
      `      ${table.name}: {`,
      '        Row: {',
      renderRow(columns),
      '        };',
      '        Insert: {',
      renderInsert(columns),
      '        };',
      '        Update: {',
      renderUpdate(columns),
      '        };',
      `        Relationships: ${relBlock};`,
      '      };',
    ].join('\n');
  });

  return `/**
 * 本文件由 scripts/gen-db-types.mjs 自动生成，请勿手改。
 *
 * 数据来源：supabase/migrations/0001_init.sql
 * 重新生成：node scripts/gen-db-types.mjs（也可执行 pnpm db:types）
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** JSON 值类型（与 @supabase/supabase-js 的 Json 定义一致） */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
${blocks.join('\n')}
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

/** 编译期自检：Database 必须能直接作为 SupabaseClient 的泛型参数 */
export type DatabaseIsClientCompatible = SupabaseClient<Database>;
`;
}

/* ── 主流程 ────────────────────────────────────────────────────────────── */

if (!existsSync(SQL_PATH)) {
  console.error(`[FAIL] 找不到迁移文件：${SQL_PATH.replace(`${repoRoot}/`, '')}`);
  process.exit(1);
}

const sql = readFileSync(SQL_PATH, 'utf8');
const rawTables = extractTables(sql);

const tables = rawTables.map((t) => ({ name: t.name, columns: parseColumns(t.body) }));

if (tables.length === 0) {
  console.error('[FAIL] 没有从 SQL 中解析出任何表');
  process.exit(1);
}

// 外键关系要求被引用列存在且唯一，否则无法生成合法的 Relationships
const tableIndex = new Map(tables.map((t) => [t.name, t]));
for (const table of tables) {
  for (const col of table.columns) {
    if (!col.references) continue;
    const target = tableIndex.get(col.references.table);
    const targetCol = target?.columns.find((c) => c.name === col.references.column);
    if (!target || !targetCol || !targetCol.unique) {
      // 引用目标缺失或非唯一：丢弃该关系，避免生成错误的类型
      col.references = null;
    }
  }
}

const output = generate(tables);
mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, output, 'utf8');

const colCount = tables.reduce((sum, t) => sum + t.columns.length, 0);
console.log(
  `[OK] 已生成 ${OUT_PATH.replace(`${repoRoot}/`, '')}：` +
    `${tables.length} 张表 / ${colCount} 个字段`,
);
for (const t of tables) {
  const pk = t.columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
  console.log(`       - ${t.name}（${t.columns.length} 列${pk.length ? `，主键 ${pk.join(', ')}` : ''}）`);
}
