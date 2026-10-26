import { createHash, createHmac, randomUUID } from 'node:crypto';

/**
 * 后台媒体上传 · Supabase Storage（S3 兼容协议）签名与票据。
 *
 * 上传链路（对应 Supabase 官方 S3 authentication 文档）：
 *   1. 管理端 POST /api/admin/uploads（本模块签发预签名 PUT URL，即 get_upload_url）；
 *   2. 浏览器拿 URL 后直传 Supabase Storage 的 S3 端点（CORS 已放开）；
 *   3. 落库只存公开 URL（桶 weboss 公开读）。
 *
 * ⚠️ 关键坑（本次整改根因）：该网关按「收到的全部查询参数」重算签名，
 *   预签名 URL 必须把 `X-Amz-Content-Sha256=UNSIGNED-PAYLOAD` 作为查询参数
 *   纳入 canonical query——漏掉它必然 403 SignatureDoesNotMatch（手工/旧实现
 *   全军覆没的原因；官方 AWS SDK 正常是因为它默认带该参数）。
 *
 * 签名实现零依赖（node:crypto 手写 SigV4 presign），不引入 AWS SDK。
 */

/* ── 配置 ─────────────────────────────────────────────────────────────────── */

export type StorageUploadConfig = {
  /** S3 兼容端点（https://…/storage/v1/s3） */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** 公开读基址（…/storage/v1/object/public）；缺省从 endpoint 推导 */
  publicBaseUrl?: string;
};

/** 允许的上传场景（对象 key 的顶层目录）。不在名单内的场景按 media 兜底。 */
export const UPLOAD_SCENES = ['covers', 'body', 'media'] as const;
export type UploadScene = (typeof UPLOAD_SCENES)[number];

/** 单图上限 10MB（服务端兜底；前端同样预检）。 */
export const UPLOAD_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** 允许的图片 MIME → 扩展名（SVG 会被公开静态服务，存在存储型 XSS 风险，不放行）。 */
export const UPLOAD_IMAGE_EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const PRIVATE_V4_BLOCKS = [
  '127.0.0.0/8',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '169.254.0.0/16',
  '0.0.0.0/8',
];

function ipv4ToInt(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const bytes = parts.map((p) => Number(p));
  if (bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255)) return null;
  return bytes;
}

function inCidr(bytes: number[], cidr: string): boolean {
  const [net, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  const netBytes = ipv4ToInt(net);
  if (!netBytes) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  const ip = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const netInt = ((netBytes[0] << 24) | (netBytes[1] << 16) | (netBytes[2] << 8) | netBytes[3]) >>> 0;
  return (ip & mask) === (netInt & mask);
}

/**
 * 服务端会接触的上传端点安全闸门：仅 http(s)，且拒绝
 * localhost / 环回 / 私有 / 保留地址（含 IPv6 环回与链路本地）。
 */
export function isSafeUploadEndpoint(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost')) return false;
  if (host === '::1' || host === '::' || host === '0.0.0.0') return false;
  if (/^f[cd][0-9a-f]{2}:/.test(host)) return false; // IPv6 ULA fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(host)) return false; // IPv6 链路本地 fe80::/10
  const bytes = ipv4ToInt(host);
  if (bytes && PRIVATE_V4_BLOCKS.some((cidr) => inCidr(bytes, cidr))) return false;
  return true;
}

/** 读 .env 的 S3_* 配置；任一项缺失或端点不安全 → null（上层给「未配置上传」提示）。 */
export function getStorageUploadConfigFromEnv(): StorageUploadConfig | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const region = process.env.S3_REGION?.trim();
  const bucket = process.env.S3_BUCKET_NAME?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) return null;
  if (!isSafeUploadEndpoint(endpoint)) return null;
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

/* ── 对象 key 与校验 ──────────────────────────────────────────────────────── */

export class UploadTicketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadTicketError';
  }
}

export function normalizeScene(scene: unknown): UploadScene {
  const s = typeof scene === 'string' ? scene.trim().toLowerCase() : '';
  return (UPLOAD_SCENES as readonly string[]).includes(s) ? (s as UploadScene) : 'media';
}

function safeExtFromFilename(filename: string): string | null {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{2,5}$/.test(ext) ? ext : null;
}

/**
 * 生成对象 key：`<scene>/<yyyy>/<mm>/<uuid>.<ext>`。
 * 扩展名只信 MIME（客户端声明的 filename 仅兜底），且必须在图片白名单内。
 */
export function buildImageObjectKey(
  scene: unknown,
  filename: string,
  contentType: string,
  now = new Date(),
): string {
  const mime = contentType.trim().toLowerCase().split(';')[0];
  let ext = UPLOAD_IMAGE_EXT_BY_MIME[mime];
  if (!ext) {
    // MIME 不在白名单：再看文件名扩展名是否恰好映射回某个白名单 MIME
    const byExt = safeExtFromFilename(filename ?? '');
    if (byExt) {
      const mimeByExt = Object.entries(UPLOAD_IMAGE_EXT_BY_MIME).find(([, e]) => e === byExt)?.[0];
      if (mimeByExt) ext = byExt;
    }
  }
  if (!ext) throw new UploadTicketError('仅支持 jpg / png / webp / gif / avif 图片');
  const yyyy = String(now.getFullYear()).padStart(4, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${normalizeScene(scene)}/${yyyy}/${mm}/${randomUUID()}.${ext}`;
}

/* ── SigV4 预签名（presigned PUT）────────────────────────────────────────── */

const hmacSha256 = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest();
const sha256Hex = (data: string) => createHash('sha256').update(data).digest('hex');

/** RFC3986 严格编码（AWS 规范要求编码 ! ' ( * ） */
function awsUriEncode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export type PresignedPut = {
  /** 完整预签名 URL（浏览器直接 PUT） */
  url: string;
  /** 签名时刻（客户端 PUT 时可原样带 x-amz-date 头，不必须） */
  amzDate: string;
  /** 票据失效时刻（epoch ms） */
  expiresAt: number;
};

/**
 * 手写 S3 presigned PUT（零依赖）。
 * 签名查询参数固定六个：Algorithm / Content-Sha256(UNSIGNED-PAYLOAD) /
 * Credential / Date / Expires / SignedHeaders —— 参数按字节序排序。
 *
 * Content-Type 一并签入（SignedHeaders=content-type;host）：票据签发时的 MIME
 * 白名单才真正约束到实际 PUT——客户端必须原样携带 ticket.contentType，
 * 改发 image/svg+xml 或其他值会被网关以签名不匹配拒绝。
 */
export function presignS3Put(
  config: StorageUploadConfig,
  key: string,
  expiresInSeconds: number,
  contentType: string,
  now = new Date(),
): PresignedPut {
  const endpointUrl = new URL(config.endpoint);
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const keyPath = key.split('/').map(awsUriEncode).join('/');
  const canonicalUri = endpointUrl.pathname.replace(/\/+$/, '') + `/${config.bucket}/${keyPath}`;
  const mime = contentType.trim().toLowerCase();

  const canonicalQuery = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Content-Sha256', 'UNSIGNED-PAYLOAD'],
    ['X-Amz-Credential', `${config.accessKeyId}/${dateStamp}/${config.region}/s3/aws4_request`],
    ['X-Amz-Date', amzDate],
    ['X-Amz-Expires', String(expiresInSeconds)],
    ['X-Amz-SignedHeaders', 'content-type;host'],
  ]
    .map(([k, v]) => [k, v] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${awsUriEncode(k)}=${awsUriEncode(v)}`)
    .join('&');

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    `content-type:${mime}`,
    `host:${endpointUrl.host}`,
    '',
    'content-type;host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const kDate = hmacSha256(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, config.region);
  const kService = hmacSha256(kRegion, 's3');
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

  return {
    url: `${config.endpoint.replace(/\/+$/, '')}/${config.bucket}/${keyPath}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    amzDate,
    expiresAt: now.getTime() + expiresInSeconds * 1000,
  };
}

/* ── 票据（API 路由的载荷）───────────────────────────────────────────────── */

export type ImageUploadTicket = {
  /** 对象 key（媒体库登记的 path） */
  key: string;
  /** 预签名 PUT URL（10 分钟有效；Content-Type 已签入，PUT 必须原样携带 contentType） */
  uploadUrl: string;
  /** 上传完成后的公开访问 URL（落库用这个） */
  publicUrl: string;
  /** PUT 时必须携带的 Content-Type（与签名绑定，改值即 403） */
  contentType: string;
  expiresAt: number;
};

/** 由对象 key 拼公开读 URL（优先 NEXT_PUBLIC_SUPABASE_URL，缺省从 endpoint 推导）。 */
export function publicUrlFor(config: StorageUploadConfig, key: string): string {
  const base =
    config.publicBaseUrl ??
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ??
    new URL(config.endpoint).origin;
  const publicBase = base.endsWith('/storage/v1')
    ? `${base}/object/public`
    : `${base.replace(/\/+$/, '')}/storage/v1/object/public`;
  return `${publicBase}/${config.bucket}/${key.split('/').map(awsUriEncode).join('/')}`;
}

/**
 * 校验入参并签发上传票据（get_upload_url 的服务端实现）。
 * 抛 UploadTicketError = 调用方参数问题（400）；配置缺失返回 null（503）。
 */
export function createImageUploadTicket(
  input: { scene?: unknown; filename?: unknown; contentType?: unknown; size?: unknown },
  opts?: { config?: StorageUploadConfig | null; now?: Date; expiresInSeconds?: number },
): ImageUploadTicket | null {
  const config = opts?.config !== undefined ? opts.config : getStorageUploadConfigFromEnv();
  if (!config || !isSafeUploadEndpoint(config.endpoint)) return null;

  const filename = typeof input.filename === 'string' ? input.filename : '';
  const rawMime = typeof input.contentType === 'string' ? input.contentType : '';
  const size = typeof input.size === 'number' ? input.size : Number(input.size);
  // 签名与票据返回都用归一后的 MIME，客户端 PUT 原样携带即与签名一致
  const contentType = rawMime.trim().toLowerCase().split(';')[0];

  if (!contentType || !UPLOAD_IMAGE_EXT_BY_MIME[contentType]) {
    throw new UploadTicketError('仅支持 jpg / png / webp / gif / avif 图片');
  }
  if (!Number.isFinite(size) || size <= 0) throw new UploadTicketError('文件大小不合法');
  if (size > UPLOAD_MAX_IMAGE_BYTES) {
    throw new UploadTicketError(`图片不能超过 ${Math.floor(UPLOAD_MAX_IMAGE_BYTES / 1024 / 1024)}MB`);
  }

  const key = buildImageObjectKey(input.scene, filename, contentType, opts?.now);
  const presigned = presignS3Put(config, key, opts?.expiresInSeconds ?? 600, contentType, opts?.now);
  return {
    key,
    uploadUrl: presigned.url,
    publicUrl: publicUrlFor(config, key),
    contentType,
    expiresAt: presigned.expiresAt,
  };
}
