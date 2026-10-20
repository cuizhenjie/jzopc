import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { site, brand } from '@/lib/site/config';

/**
 * 动态 OG 分享图：1200×630 PNG。
 * 文案只取自 src/lib/site/config.ts，支持 ?title= / ?subtitle= 覆写。
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 文案长度上限（超出截断，避免撑破布局） */
const MAX_TITLE = 40;
const MAX_SUBTITLE = 80;

/** 字体只需加载一次，进程内缓存 */
let fontCache: Promise<Buffer | null> | null = null;

/**
 * 读取内置中文字体；失败时降级为 next/og 自带字体（仅拉丁字符）。
 *
 * ⚠️ 路径必须是**字面量**：Next 的 output file tracing 只能静态识别
 * `path.join(process.cwd(), '<字面量>')` 这一种形态，用变量拼接会导致
 * 字体不被打进部署产物（线上 OG 图中文会变成豆腐块）。
 * 另有 next.config.ts 的 outputFileTracingIncludes 双重兜底。
 */
function loadFont(): Promise<Buffer | null> {
  fontCache ??= (async () => {
    try {
      return await readFile(
        path.join(process.cwd(), 'src/app/api/og/fonts/NotoSansSC-Regular.otf'),
      );
    } catch (e) {
      console.error('[og:font-load-failed]', e);
      return null;
    }
  })();
  return fontCache;
}

/** 截断超长文本 */
function clampText(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/** 依据长度自适应标题字号，避免超长文字撑破布局 */
function titleFontSize(length: number): number {
  if (length > 30) return 46;
  if (length > 20) return 54;
  return 64;
}

/** 读取查询参数（已由 URLSearchParams 解码） */
function readParam(url: string, key: string): string {
  try {
    return new URL(url).searchParams.get(key) ?? '';
  } catch {
    return '';
  }
}

/** 品牌底图：深藏蓝 → 主蓝渐变 + 青色径向光晕 */
function backgroundLayer() {
  return (
    <>
      {/* 光晕 */}
      <div
        style={{
          position: 'absolute',
          top: -260,
          right: -180,
          width: 820,
          height: 820,
          borderRadius: 410,
          background:
            'radial-gradient(circle at center, rgba(100,196,217,0.42) 0%, rgba(100,196,217,0) 70%)',
        }}
      />
      {/* 底部青色压边 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: '100%',
          height: 12,
          background: `linear-gradient(90deg, ${brand.gradientFrom} 0%, ${brand.gradientTo} 100%)`,
        }}
      />
    </>
  );
}

/** 主图渲染 */
function ogElement(title: string, subtitle: string, description: string) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        padding: '76px 92px 64px',
        background: `linear-gradient(135deg, ${brand.navy} 0%, ${brand.blue} 58%, ${brand.gradientFrom} 100%)`,
        color: '#ffffff',
        fontFamily: '"Noto Sans SC", sans-serif',
      }}
    >
      {backgroundLayer()}

      {/* 顶部品牌标识 */}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <div
          style={{
            width: 64,
            height: 6,
            borderRadius: 3,
            background: `linear-gradient(90deg, ${brand.teal} 0%, ${brand.gradientTo} 100%)`,
            marginRight: 20,
          }}
        />
        <div style={{ display: 'flex', fontSize: 26, letterSpacing: 6, color: 'rgba(255,255,255,0.78)' }}>
          {site.latin}
        </div>
      </div>

      {/* 主文案 */}
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 1016 }}>
        <div
          style={{
            display: 'flex',
            fontSize: titleFontSize(title.length),
            fontWeight: 700,
            lineHeight: 1.25,
            wordBreak: 'break-all',
            color: '#ffffff',
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 22,
            fontSize: 38,
            lineHeight: 1.4,
            color: '#C6ECF9',
          }}
        >
          {subtitle}
        </div>
        <div
          style={{
            display: 'flex',
            marginTop: 26,
            fontSize: 26,
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.82)',
          }}
        >
          {description}
        </div>
      </div>

      {/* 底部信息 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: 24,
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        <div style={{ display: 'flex' }}>{site.name}</div>
        <div style={{ display: 'flex' }}>{site.company}</div>
      </div>
    </div>
  );
}

/** 兜底图：结构最简，只保留品牌色与站点名 */
function fallbackElement() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, ${brand.navy} 0%, ${brand.blue} 100%)`,
        color: '#ffffff',
        fontFamily: '"Noto Sans SC", sans-serif',
      }}
    >
      <div style={{ display: 'flex', fontSize: 64, fontWeight: 700 }}>{site.name}</div>
      <div style={{ display: 'flex', marginTop: 20, fontSize: 34, color: '#C6ECF9' }}>{site.slogan}</div>
    </div>
  );
}

export async function GET(req: Request) {
  const url = req.url;
  const title = clampText(readParam(url, 'title') || site.name, MAX_TITLE);
  const subtitle = clampText(readParam(url, 'subtitle') || site.slogan, MAX_SUBTITLE);
  const description = site.tagline;

  const font = await loadFont();
  const fonts = font
    ? [{ name: 'Noto Sans SC', data: font, weight: 400 as const, style: 'normal' as const }]
    : undefined;

  try {
    return new ImageResponse(ogElement(title, subtitle, description), {
      width: 1200,
      height: 630,
      fonts,
    });
  } catch (e) {
    // 渲染异常不返回 500：降级为兜底图
    console.error('[og:render-failed]', e);
    try {
      return new ImageResponse(fallbackElement(), {
        width: 1200,
        height: 630,
        fonts,
      });
    } catch (e2) {
      console.error('[og:fallback-failed]', e2);
      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: brand.navy,
              color: '#ffffff',
              fontSize: 48,
            }}
          >
            {site.name}
          </div>
        ),
        { width: 1200, height: 630 },
      );
    }
  }
}
