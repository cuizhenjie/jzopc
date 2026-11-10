/** 复刻页 DOM 定位工具（2026-11-10）。
 *
 * 编译期给需要接后台的容器打了 `data-opc-block="<marker>"` 标记；
 * 运行期按标记找到容器并**整体替换内部**，容器自身的标签与属性保留。
 *
 * 标记缺失或结构不完整 → 原样返回（外壳完整性保护，绝不截断页面）。
 */

/** 找到带 `data-opc-block="marker"` 的元素，按标签配平找到闭标签，替换其内部。 */
export function replaceBlockInner(
  html: string,
  marker: string,
  tagName: string,
  buildInner: (originalInner: string) => string,
): string {
  const openPattern = new RegExp(`<${tagName}\\b[^>]*\\bdata-opc-block="${marker}"[^>]*>`, 'i');
  const found = html.match(openPattern);
  if (!found || found.index === undefined) return html;
  const openTag = found[0];
  const openTagEnd = found.index + openTag.length;
  const openToken = `<${tagName}`;
  const closeToken = `</${tagName}>`;
  let depth = 1;
  let cursor = openTagEnd;
  while (depth > 0) {
    const nextOpenAt = html.indexOf(openToken, cursor);
    const nextCloseAt = html.indexOf(closeToken, cursor);
    if (nextCloseAt < 0) return html;
    if (nextOpenAt >= 0 && nextOpenAt < nextCloseAt) {
      depth += 1;
      cursor = nextOpenAt + openToken.length;
    } else {
      depth -= 1;
      if (depth === 0) {
        const inner = html.slice(openTagEnd, nextCloseAt);
        return html.slice(0, openTagEnd) + buildInner(inner) + html.slice(nextCloseAt);
      }
      cursor = nextCloseAt + closeToken.length;
    }
  }
  return html;
}

/** 按 id 定位单个元素并替换其内部（用于 #agentCount 之类的短标签）。 */
export function replaceElementInnerById(
  html: string,
  id: string,
  tagName: string,
  buildInner: (originalInner: string) => string,
): string {
  const openPattern = new RegExp(`<${tagName}\\b[^>]*\\bid="${id}"[^>]*>`, 'i');
  const found = html.match(openPattern);
  if (!found || found.index === undefined) return html;
  const openTag = found[0];
  const openTagEnd = found.index + openTag.length;
  const closeToken = `</${tagName}>`;
  const closeAt = html.indexOf(closeToken, openTagEnd);
  if (closeAt < 0) return html;
  const inner = html.slice(openTagEnd, closeAt);
  return html.slice(0, openTagEnd) + buildInner(inner) + html.slice(closeAt);
}
