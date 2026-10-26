import { NextResponse } from 'next/server';
import { rejectIfUnauthedApi } from '@/lib/admin/auth';
import {
  UploadTicketError,
  createImageUploadTicket,
  getStorageUploadConfigFromEnv,
} from '@/lib/admin/storage';

/**
 * 后台媒体上传 · 预签名票据接口（get_upload_url）。
 *
 * POST /api/admin/uploads
 *   body: { scene?: 'covers'|'body'|'media', filename: string,
 *           contentType: string, size: number }
 *   → { ok, key, uploadUrl, publicUrl, expiresAt }
 *
 * 流程：本接口只签发 Supabase Storage（S3 兼容端点）的预签名 PUT URL；
 * 浏览器随后直传对象存储，成功后把 publicUrl 落库。
 * 未配置 S3_* 环境变量 → 503（表单降级为仅可粘贴外链 URL）。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const unauthed = await rejectIfUnauthedApi(req);
  if (unauthed) return unauthed;

  if (!getStorageUploadConfigFromEnv()) {
    return NextResponse.json(
      { ok: false, message: '上传未配置：请在环境变量中补齐 S3_* 参数（见 .env.example）' },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, message: '请求格式错误' }, { status: 400 });
  }

  try {
    const ticket = createImageUploadTicket(body);
    if (!ticket) {
      return NextResponse.json(
        { ok: false, message: '上传未配置：请在环境变量中补齐 S3_* 参数（见 .env.example）' },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, ...ticket });
  } catch (err) {
    if (err instanceof UploadTicketError) {
      return NextResponse.json({ ok: false, message: err.message }, { status: 400 });
    }
    console.error('[admin:uploads-ticket-failed]', err);
    return NextResponse.json({ ok: false, message: '签发上传链接失败，请稍后重试。' }, { status: 500 });
  }
}
