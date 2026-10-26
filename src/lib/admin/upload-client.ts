/**
 * 后台媒体上传 · 浏览器端工具（与 /api/admin/uploads 票据接口配对）。
 *
 * 流程：取票据（get_upload_url）→ PUT 直传 Supabase Storage → 返回公开 URL。
 * 所有错误都转成中文可读的 Error（组件直接展示 message）。
 */

export type UploadedImage = {
  url: string;
  key: string;
  size: number;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

/** 打开系统文件选择框（仅图片）。取消 → null。 */
export function pickImageFile(multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
    input.multiple = multiple;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const files = Array.from(input.files ?? []);
      input.remove();
      resolve(files);
    });
    // 取消选择不会触发 change；用 focus 兜底清理（部分浏览器关闭面板会回焦点）
    window.addEventListener(
      'focus',
      () => setTimeout(() => {
        if (document.body.contains(input)) {
          input.remove();
          resolve([]);
        }
      }, 500),
      { once: true },
    );
    document.body.appendChild(input);
    input.click();
  });
}

/** 上传单张图片：取票据 + PUT 直传 + 校验。 */
export async function uploadImageFile(file: File, scene: string): Promise<UploadedImage> {
  if (!ACCEPTED_MIME.includes(file.type)) {
    throw new Error('仅支持 jpg / png / webp / gif / avif 图片');
  }
  if (file.size <= 0) throw new Error('文件为空');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('图片不能超过 10MB');

  const res = await fetch('/api/admin/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scene, filename: file.name, contentType: file.type, size: file.size }),
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    message?: string;
    key?: string;
    uploadUrl?: string;
    publicUrl?: string;
    contentType?: string;
  } | null;

  if (!res.ok || !data?.ok || !data.uploadUrl || !data.publicUrl || !data.key) {
    throw new Error(data?.message ?? '获取上传链接失败，请重新登录后再试。');
  }

  // Content-Type 已签入预签名 URL，必须用票据返回值原样携带（改值即 403）
  const put = await fetch(data.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': data.contentType ?? file.type },
    body: file,
  });
  if (!put.ok) {
    throw new Error(`直传失败（${put.status}），请重试；若持续失败请检查网络。`);
  }
  return { url: data.publicUrl, key: data.key, size: file.size };
}

/**
 * 富文本编辑器 / 封面上传的常用组合：选一张 → 上传 → 返回 URL。
 * 取消或失败返回 null（失败时已 alert，编辑器不必再报）。
 */
export async function pickAndUploadImage(scene: string): Promise<string | null> {
  const [file] = await pickImageFile();
  if (!file) return null;
  try {
    const uploaded = await uploadImageFile(file, scene);
    return uploaded.url;
  } catch (err) {
    window.alert(err instanceof Error ? err.message : '上传失败，请重试。');
    return null;
  }
}
