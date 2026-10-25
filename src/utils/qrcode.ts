/**
 * 二维码渲染。
 *
 * `qrcode` 是纯计算库（≈15KB gzip），只在分享弹窗打开时才需要。
 * 这里用动态 `import()` 让 Vite 把它拆成独立 chunk，
 * 避免为了一次「点分享」让所有访客多下载一个依赖。
 */

export interface QrOptions {
  /** 画布边长（CSS 像素），默认 220 */
  size?: number;
  /** 前景色，默认近黑（纯黑在部分屏幕上有摩尔纹） */
  dark?: string;
  /** 背景色 */
  light?: string;
}

/**
 * 把文本渲染成二维码并写入给定 canvas。
 * 失败时抛错，由调用方决定降级方式（通常隐藏二维码区域，保留复制链接）。
 */
export async function renderQrToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  options: QrOptions = {}
): Promise<void> {
  if (!canvas || !text) throw new Error('缺少二维码渲染目标或内容');

  const { toCanvas } = await import('qrcode');
  const { size = 220, dark = '#0f172a', light = '#ffffff' } = options;

  await toCanvas(canvas, text, {
    width: size,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark, light }
  });
}

/** 把已渲染的 canvas 导出成 PNG 并触发下载 */
export function downloadCanvas(canvas: HTMLCanvasElement, filename = 'share-qrcode.png'): void {
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
