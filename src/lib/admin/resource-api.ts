import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { rejectIfUnauthedApi } from '@/lib/admin/auth';
import { zodFieldErrors } from '@/lib/admin/news-schema';

/**
 * 管理后台「资源模块」通用 API 工厂。
 *
 * 八个规划中模块（agents / market / courses / partners / site-stats /
 * empower / site-contents / media）的 REST 语义完全同构：
 *   POST   /api/admin/<res>            创建
 *   PATCH  /api/admin/<res>/<pk>       全量更新，或 {published} 快捷上下架
 *   DELETE /api/admin/<res>/<pk>       彻底删除
 * 统一由本工厂生成，路由文件只做一行装配 —— 增改模块不再复制粘贴。
 *
 * 统一行为（同时是 2026-10-24 测试发现的 P3 修复基准）：
 *   - 更新/删除不存在的 pk → 404（而不是 500 / 静默 200）；
 *   - 唯一约束冲突（23505）→ 409 + 字段级提示；
 *   - 未登录 → 401（复用 rejectIfUnauthedApi）；
 *   - zod 校验失败 → 400 + 字段级 errors。
 */

export type PkKind = 'id' | 'slug' | 'key';

/** revalidatePath 目标：字符串 = 具体路径；对象 = 动态路由模板需显式 type */
export type RevalidateTarget = string | { path: string; type: 'page' | 'layout' };

function revalidateAll(targets: RevalidateTarget[] | undefined): void {
  for (const t of targets ?? []) {
    if (typeof t === 'string') revalidatePath(t);
    else revalidatePath(t.path, t.type);
  }
}

type UniqueHint = { field: string; message: string };

export function createResourceCollectionApi<TInput>(opts: {
  table: string;
  schema: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  /** schema 解析结果 → 表行 */
  toRow: (input: TInput) => Record<string, unknown>;
  /** 唯一冲突时的字段提示（默认猜 slug） */
  uniqueHint?: UniqueHint;
  /** 创建成功后需要失效的公开站路径（动态路由模板用 {path, type} 形态） */
  revalidate?: RevalidateTarget[];
  /** 额外的 POST 前置校验（如 section+slug 组合冲突提示） */
  conflictMessage?: string;
}) {
  return async function POST(req: Request) {
    const unauthed = await rejectIfUnauthedApi(req);
    if (unauthed) return unauthed;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, message: '请求格式错误' }, { status: 400 });
    }

    const parsed = opts.schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: '请检查表单填写是否完整。', errors: zodFieldErrors(parsed.error.issues) },
        { status: 400 },
      );
    }

    const sb = getSupabaseAdmin();
    if (!sb) {
      return NextResponse.json({ ok: false, message: '未连接数据库，无法保存' }, { status: 503 });
    }

    const { data, error } = await sb.from(opts.table).insert(opts.toRow(parsed.data)).select('id').single();
    if (error) {
      if (error.code === '23505') {
        const hint = opts.uniqueHint ?? { field: 'slug', message: '该 slug 已存在' };
        return NextResponse.json(
          { ok: false, message: opts.conflictMessage ?? '保存冲突：唯一标识已被占用。', errors: { [hint.field]: hint.message } },
          { status: 409 },
        );
      }
      // FK 违反（如引用的分类不存在）→ 表单可修的 400，而不是 500
      if (error.code === '23503') {
        return NextResponse.json(
          { ok: false, message: '保存失败：引用的分类或关联记录不存在，请检查下拉选项。' },
          { status: 400 },
        );
      }
      console.error(`[admin:${opts.table}-create-failed]`, error);
      return NextResponse.json({ ok: false, message: '保存失败，请稍后重试。' }, { status: 500 });
    }

    revalidateAll(opts.revalidate);
    return NextResponse.json({ ok: true, id: (data as { id?: number })?.id ?? null });
  };
}

export function createResourceItemApi<TInput>(opts: {
  table: string;
  pk: PkKind;
  schema?: z.ZodType<TInput, z.ZodTypeDef, unknown>;
  toRow?: (input: TInput) => Record<string, unknown>;
  revalidate?: RevalidateTarget[];
}) {
  function parsePk(raw: string): number | string | null {
    if (opts.pk === 'id') {
      const n = Number(raw);
      return Number.isInteger(n) && n > 0 ? n : null;
    }
    const s = decodeURIComponent(raw).trim();
    return s.length > 0 && s.length <= 120 ? s : null;
  }

  return {
    /** 单条读取（编辑页预填用；不存在 → 404）。params 键名随路由（id/slug） */
    async GET(req: Request, ctx: { params: Promise<Record<string, string>> }) {
      const unauthed = await rejectIfUnauthedApi(req);
      if (unauthed) return unauthed;
      const rawParams = await ctx.params;
      const pk = parsePk(rawParams[opts.pk] ?? Object.values(rawParams)[0] ?? '');
      if (pk === null) return NextResponse.json({ ok: false, message: '参数不合法' }, { status: 400 });

      const sb = getSupabaseAdmin();
      if (!sb) return NextResponse.json({ ok: false, message: '未连接数据库' }, { status: 503 });

      const { data, error } = await sb.from(opts.table).select('*').eq(opts.pk, pk).maybeSingle();
      if (error) {
        console.error(`[admin:${opts.table}-get-failed]`, error);
        return NextResponse.json({ ok: false, message: '读取失败' }, { status: 500 });
      }
      if (!data) return NextResponse.json({ ok: false, message: '记录不存在' }, { status: 404 });
      return NextResponse.json({ ok: true, data });
    },

    async PATCH(req: Request, ctx: { params: Promise<Record<string, string>> }) {
      const unauthed = await rejectIfUnauthedApi(req);
      if (unauthed) return unauthed;
      const rawParams = await ctx.params;
      const pk = parsePk(rawParams[opts.pk] ?? Object.values(rawParams)[0] ?? '');
      if (pk === null) return NextResponse.json({ ok: false, message: '参数不合法' }, { status: 400 });

      let body: Record<string, unknown>;
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ ok: false, message: '请求格式错误' }, { status: 400 });
      }

      const sb = getSupabaseAdmin();
      if (!sb) return NextResponse.json({ ok: false, message: '未连接数据库，无法保存' }, { status: 503 });

      // 快捷路径：仅 {published} → 上下架切换（ResourceTable 的发布/下架按钮）
      const keys = Object.keys(body);
      let patch: Record<string, unknown>;
      if (opts.schema && keys.length === 1 && keys[0] === 'published' && typeof body.published === 'boolean') {
        patch = { published: body.published };
      } else if (opts.schema && opts.toRow) {
        const parsed = opts.schema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { ok: false, message: '请检查表单填写是否完整。', errors: zodFieldErrors(parsed.error.issues) },
            { status: 400 },
          );
        }
        patch = opts.toRow(parsed.data);
      } else {
        return NextResponse.json({ ok: false, message: '没有要更新的字段' }, { status: 400 });
      }

      const { data, error } = await sb
        .from(opts.table)
        .update(patch)
        .eq(opts.pk, pk)
        .select(opts.pk === 'id' ? 'id' : opts.pk)
        .limit(1);
      if (error) {
        if (error.code === '23505') {
          return NextResponse.json({ ok: false, message: '保存冲突：唯一标识已被占用。' }, { status: 409 });
        }
        console.error(`[admin:${opts.table}-update-failed]`, error);
        return NextResponse.json({ ok: false, message: '更新失败' }, { status: 500 });
      }
      // 更新不存在的记录 → 404（不再静默成功）
      if (!data || data.length === 0) {
        return NextResponse.json({ ok: false, message: '记录不存在' }, { status: 404 });
      }

      revalidateAll(opts.revalidate);
      return NextResponse.json({ ok: true });
    },

    async DELETE(req: Request, ctx: { params: Promise<Record<string, string>> }) {
      const unauthed = await rejectIfUnauthedApi(req);
      if (unauthed) return unauthed;
      const rawParams = await ctx.params;
      const pk = parsePk(rawParams[opts.pk] ?? Object.values(rawParams)[0] ?? '');
      if (pk === null) return NextResponse.json({ ok: false, message: '参数不合法' }, { status: 400 });

      const sb = getSupabaseAdmin();
      if (!sb) return NextResponse.json({ ok: false, message: '未连接数据库' }, { status: 503 });

      const { data, error } = await sb
        .from(opts.table)
        .delete()
        .eq(opts.pk, pk)
        .select(opts.pk === 'id' ? 'id' : opts.pk)
        .limit(1);
      if (error) {
        console.error(`[admin:${opts.table}-delete-failed]`, error);
        return NextResponse.json({ ok: false, message: '删除失败' }, { status: 500 });
      }
      if (!data || data.length === 0) {
        return NextResponse.json({ ok: false, message: '记录不存在' }, { status: 404 });
      }

      revalidateAll(opts.revalidate);
      return NextResponse.json({ ok: true });
    },
  };
}
