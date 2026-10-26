/**
 * 后台媒体上传（Supabase Storage S3 预签名）核心纯函数单测。
 *
 * 背景：该网关按「收到的全部查询参数」重算签名，预签名 URL 必须携带
 * X-Amz-Content-Sha256=UNSIGNED-PAYLOAD 查询参数（漏掉 = 403 SignatureDoesNotMatch，
 * 即封面图上传整改前的线上问题）。这里锁定该行为与校验闸门。
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  UploadTicketError,
  UPLOAD_IMAGE_EXT_BY_MIME,
  buildImageObjectKey,
  createImageUploadTicket,
  isSafeUploadEndpoint,
  normalizeScene,
  presignS3Put,
  publicUrlFor,
  type StorageUploadConfig,
} from '@/lib/admin/storage';

const FAKE_NOW = new Date('2026-10-26T08:30:00Z');

const config: StorageUploadConfig = {
  endpoint: 'https://storage.example.com/storage/v1/s3',
  region: 'cn-beijing',
  bucket: 'weboss',
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'SECRETEXAMPLE',
  publicBaseUrl: 'https://site.example.com',
};

describe('normalizeScene', () => {
  test('白名单场景原样保留，其余一律落 media', () => {
    assert.equal(normalizeScene('covers'), 'covers');
    assert.equal(normalizeScene('body'), 'body');
    assert.equal(normalizeScene('media'), 'media');
    assert.equal(normalizeScene('unknown'), 'media');
    assert.equal(normalizeScene('../../etc'), 'media');
    assert.equal(normalizeScene(undefined), 'media');
  });
});

describe('isSafeUploadEndpoint', () => {
  test('拒绝非 http(s) 协议', () => {
    assert.equal(isSafeUploadEndpoint('ftp://storage.example.com/s3'), false);
    assert.equal(isSafeUploadEndpoint('file:///etc/passwd'), false);
    assert.equal(isSafeUploadEndpoint('not a url'), false);
  });

  test('拒绝 localhost / 环回 / 私有 / 保留地址', () => {
    for (const bad of [
      'http://localhost/storage/v1/s3',
      'http://api.localhost/storage/v1/s3',
      'http://127.0.0.1:54321/storage/v1/s3',
      'http://10.1.2.3/storage/v1/s3',
      'http://172.16.0.9/storage/v1/s3',
      'http://172.31.255.255/storage/v1/s3',
      'http://192.168.1.5/storage/v1/s3',
      'http://169.254.169.254/storage/v1/s3',
      'http://0.0.0.0/storage/v1/s3',
      'http://[::1]/storage/v1/s3',
      'http://[fe80::1]/storage/v1/s3',
      'http://[fc00::1]/storage/v1/s3',
    ]) {
      assert.equal(isSafeUploadEndpoint(bad), false, bad);
    }
  });

  test('放行公网 http(s) 端点', () => {
    assert.equal(isSafeUploadEndpoint('https://br-x.supabase.volces.com/storage/v1/s3'), true);
    assert.equal(isSafeUploadEndpoint('https://storage.example.com:8443/storage/v1/s3'), true);
  });
});

describe('buildImageObjectKey', () => {
  test('key 形如 <scene>/<yyyy>/<mm>/<uuid>.<白名单扩展名>', () => {
    const key = buildImageObjectKey('covers', '封面 图.png', 'image/png', FAKE_NOW);
    assert.match(key, /^covers\/2026\/10\/[0-9a-f-]{36}\.png$/);
  });

  test('未知场景归入 media；扩展名只信白名单', () => {
    assert.match(buildImageObjectKey('hack', 'a.jpg', 'image/jpeg', FAKE_NOW), /^media\//);
    assert.throws(() => buildImageObjectKey('media', 'logo.svg', 'image/svg+xml', FAKE_NOW), UploadTicketError);
    assert.throws(() => buildImageObjectKey('media', 'shell.php', 'application/octet-stream', FAKE_NOW), UploadTicketError);
  });

  test('MIME 缺白名单时按文件名扩展名兜底', () => {
    const key = buildImageObjectKey('media', 'photo.webp', 'application/octet-stream', FAKE_NOW);
    assert.match(key, /\.webp$/);
  });

  test('白名单 MIME 全覆盖常用格式', () => {
    assert.deepEqual(Object.values(UPLOAD_IMAGE_EXT_BY_MIME).sort(), ['avif', 'gif', 'jpg', 'png', 'webp']);
  });
});

describe('presignS3Put（整改根因回归锚点）', () => {
  test('预签名 URL 必须携带 UNSIGNED-PAYLOAD 查询参数且签名 64 位十六进制', () => {
    const { url } = presignS3Put(config, 'covers/2026/10/uuid.png', 600, 'image/png', FAKE_NOW);
    const u = new URL(url);
    assert.equal(u.pathname, '/storage/v1/s3/weboss/covers/2026/10/uuid.png');
    assert.equal(u.searchParams.get('X-Amz-Content-Sha256'), 'UNSIGNED-PAYLOAD');
    assert.equal(u.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
    assert.equal(u.searchParams.get('X-Amz-SignedHeaders'), 'content-type;host');
    assert.match(u.searchParams.get('X-Amz-Signature') ?? '', /^[0-9a-f]{64}$/);
    assert.equal(u.searchParams.get('X-Amz-Date'), '20261026T083000Z');
  });

  test('Content-Type 签入签名：改 MIME 即改签名（PUT 换值必 403）', () => {
    const png = presignS3Put(config, 'k.png', 60, 'image/png', FAKE_NOW).url;
    const svg = presignS3Put(config, 'k.png', 60, 'image/svg+xml', FAKE_NOW).url;
    assert.notEqual(png, svg);
  });

  test('查询参数按字节序排序（签名输入与发送 URL 完全一致）', () => {
    const { url } = presignS3Put(config, 'a.png', 60, 'image/png', FAKE_NOW);
    const names = [...new URL(url).searchParams.keys()].filter((k) => k !== 'X-Amz-Signature');
    const sorted = [...names].sort();
    assert.deepEqual(names, sorted);
  });

  test('同一输入签名确定，跨时间窗变化', () => {
    const a = presignS3Put(config, 'k.png', 60, 'image/png', FAKE_NOW).url;
    const b = presignS3Put(config, 'k.png', 60, 'image/png', FAKE_NOW).url;
    const c = presignS3Put(config, 'k.png', 60, 'image/png', new Date(FAKE_NOW.getTime() + 60_000)).url;
    assert.equal(a, b);
    assert.notEqual(a, c);
  });
});

describe('publicUrlFor', () => {
  test('拼公开读路径并逐段编码', () => {
    const url = publicUrlFor(config, 'media/2026/10/uuid.png');
    assert.equal(url, 'https://site.example.com/storage/v1/object/public/weboss/media/2026/10/uuid.png');
  });

  test('未给 publicBaseUrl 时从 endpoint 推导', () => {
    const prev = process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    try {
      const url = publicUrlFor({ ...config, publicBaseUrl: undefined }, 'a.png');
      assert.equal(url, 'https://storage.example.com/storage/v1/object/public/weboss/a.png');
    } finally {
      if (prev) process.env.NEXT_PUBLIC_SUPABASE_URL = prev;
    }
  });
});

describe('createImageUploadTicket', () => {
  test('合法入参签发票据（Content-Type 随票据下发且已签入）', () => {
    const ticket = createImageUploadTicket(
      { scene: 'covers', filename: '封面.png', contentType: 'image/png', size: 1024 },
      { config, now: FAKE_NOW },
    );
    assert.ok(ticket);
    assert.match(ticket.key, /^covers\/2026\/10\//);
    assert.ok(ticket.uploadUrl.startsWith(`${config.endpoint}/${config.bucket}/covers/`));
    assert.ok(ticket.publicUrl.endsWith('.png'));
    assert.equal(ticket.contentType, 'image/png');
    assert.equal(ticket.expiresAt, FAKE_NOW.getTime() + 600_000);
    // 票据里的 contentType 必须能通过同一签名复算（PUT 原样携带即有效）
    const reSign = presignS3Put(config, ticket.key, 600, ticket.contentType, FAKE_NOW).url;
    assert.equal(reSign, ticket.uploadUrl);
  });

  test('非白名单 MIME / 超限 / 非法 size 抛 UploadTicketError', () => {
    assert.throws(
      () => createImageUploadTicket({ filename: 'a.svg', contentType: 'image/svg+xml', size: 10 }, { config }),
      UploadTicketError,
    );
    assert.throws(
      () =>
        createImageUploadTicket(
          { filename: 'big.png', contentType: 'image/png', size: 10 * 1024 * 1024 + 1 },
          { config },
        ),
      UploadTicketError,
    );
    assert.throws(
      () => createImageUploadTicket({ filename: 'x.png', contentType: 'image/png', size: Number.NaN }, { config }),
      UploadTicketError,
    );
    assert.throws(
      () => createImageUploadTicket({ filename: 'x.png', contentType: 'image/png', size: 0 }, { config }),
      UploadTicketError,
    );
  });

  test('配置缺失（env 未配置或端点不安全）返回 null 而不是抛错', () => {
    assert.equal(createImageUploadTicket({ filename: 'a.png', contentType: 'image/png', size: 1 }, { config: null }), null);
    assert.equal(
      createImageUploadTicket(
        { filename: 'a.png', contentType: 'image/png', size: 1 },
        { config: { ...config, endpoint: 'http://192.168.0.9/storage/v1/s3' } },
      ),
      null,
    );
  });
});
