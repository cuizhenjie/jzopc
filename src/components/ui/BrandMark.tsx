import clsx from 'clsx';

/**
 * 品牌徽记 —— 直接取自项目根目录的 `logo.svg`。
 *
 * ## 资源从哪来
 *
 * `logo.svg` 是一份**竖版 lockup**：上方是几何徽记（六边形箭形 + 青色圆点 + 青绿弧），
 * 下方是「集智 AI」字标与「AI OPC 社区」灰字。原文件的 viewBox 是 `0 0 1850.59 2060.83`，
 * 底部那行灰字落在 viewBox 之外被裁掉，直接用会缺字。
 *
 * 因此派生出两个静态资源（`public/` 目录，Next.js 直接以 `/` 开头提供）：
 *
 * | 文件 | viewBox | 用途 |
 * |---|---|---|
 * | `public/logo-mark.svg` | `345.8 0 1506.8 1460.6` | **浅底版**：只裁到徽记，图形与原文件一字未改 |
 * | `public/logo-mark-inverse.svg` | 同上 | **深底反白版**：把蓝色系箭头改为白色（负形逻辑与浅底版一致） |
 *
 * 徽记的六边形内部是**留白负形**（靠背景透出），所以浅底与深底必须用不同版本 ——
 * 浅底版在深色底上轮廓会消失，反白版在浅底上则会糊成一片。
 *
 * `alt=""` 是刻意的：徽记旁边的可见文字「集智 AI / JIZHI · AI」已经提供了名称，
 * 再给图片写 alt 会让可访问名变成「集智 AI 集智 AI JIZHI · AI 首页」这种重复。
 */
export default function BrandMark({
  light = false,
  className,
}: {
  /** 深色底上使用反白版 */
  light?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- 品牌 SVG 用原生 img 更可控（无需 next/image 的 SVG 处理）
    <img
      src={light ? '/logo-mark-inverse.svg' : '/logo-mark.svg'}
      alt=""
      width={36}
      height={35}
      className={clsx('h-9 w-[35px] shrink-0', className)}
    />
  );
}
