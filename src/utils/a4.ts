/**
 * A4 纸张度量与分页计算。
 *
 * 唯一事实来源：预览画布、分页断线、AutoFit 都必须使用这里的常量，
 * 否则“测量纸张”与“测量内容”会得出互相矛盾的页数。
 *
 * 96 DPI 下 A4 物理高度 = 297mm / 25.4 * 96 ≈ 1122.52px。
 * 注意：不要用 `min-height: 297mm` 的纸张元素做测量——它恒等于一页，
 * 会让任何内容都显示为“恰好 1 页”或“始终 2 页”。
 */
export const A4_HEIGHT_PX = 1122.52;

/** A4 物理宽度（210mm @96dpi），用于缩放容器的尺寸补偿 */
export const A4_WIDTH_PX = 793.7;

/** 内容实际占用的页数（至少 1 页） */
export function getPageCount(contentHeight: number): number {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return 1;
  return Math.max(1, Math.ceil(contentHeight / A4_HEIGHT_PX));
}

/** 内容跨页处相对纸张顶部的 y 坐标（不含第一页顶部） */
export function getBreakLines(contentHeight: number): number[] {
  if (!Number.isFinite(contentHeight) || contentHeight <= A4_HEIGHT_PX) return [];
  const lines: number[] = [];
  for (let y = A4_HEIGHT_PX; y < contentHeight; y += A4_HEIGHT_PX) {
    // 保留两位小数，避免浮点累加产生 1122.5200000000002 这类值
    lines.push(Math.round(y * 100) / 100);
  }
  return lines;
}

/** 内容容器选择器：纸张内部真正承载排版内容的节点 */
export const RESUME_DOC_SELECTOR = '.resume-doc';
