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

/** 1mm 在 96 DPI 下的像素值 */
export const MM_TO_PX = 96 / 25.4;

/**
 * 一页纸真正能放内容的可用高度。
 *
 * 打印时页边距由 `@page { margin }` 提供（浏览器会给**每一页**都加上），
 * 因此可用高度 = 纸张高度 - 上下页边距。预览的页数与打印的页数必须用同一个
 * 可用高度计算，否则两边会给出不同的页数。
 */
export function getUsableHeight(pagePaddingMm: number): number {
  const padding = Number.isFinite(pagePaddingMm) && pagePaddingMm > 0 ? pagePaddingMm : 0;
  // 页边距过大时至少保留一半版面，避免出现负数可用高度
  const usable = A4_HEIGHT_PX - padding * 2 * MM_TO_PX;
  return Math.max(A4_HEIGHT_PX / 2, usable);
}

/** 内容实际占用的页数（至少 1 页） */
export function getPageCount(contentHeight: number, usableHeight: number = A4_HEIGHT_PX): number {
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return 1;
  const perPage = usableHeight > 0 ? usableHeight : A4_HEIGHT_PX;
  return Math.max(1, Math.ceil(contentHeight / perPage));
}

/**
 * 内容跨页处相对内容顶部的 y 坐标（不含第一页顶部）。
 *
 * `y` 是内容坐标系里的位置，渲染时再加上纸张 padding 才是屏幕坐标。
 */
export function getBreakLines(contentHeight: number, usableHeight: number = A4_HEIGHT_PX): number[] {
  const perPage = usableHeight > 0 ? usableHeight : A4_HEIGHT_PX;
  if (!Number.isFinite(contentHeight) || contentHeight <= perPage) return [];
  const lines: number[] = [];
  for (let y = perPage; y < contentHeight; y += perPage) {
    // 保留两位小数，避免浮点累加产生 1122.5200000000002 这类值
    lines.push(Math.round(y * 100) / 100);
  }
  return lines;
}

/** 内容容器选择器：纸张内部真正承载排版内容的节点 */
export const RESUME_DOC_SELECTOR = '.resume-doc';
