/**
 * PDF 导出：只保留浏览器原生打印这一条路径。
 *
 * 云端无头 Chromium 方案已下线（需要 Browser Rendering 绑定，且导出的 HTML
 * 丢失了鉴权头与相对资源，实测不可用）。浏览器打印在矢量、字体、分页上
 * 反而更可靠，也不需要任何服务端成本。
 */

/** 等待字体与图片就绪，避免打印预览里出现兜底字体或空白头像 */
async function waitForAssets(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (fonts?.ready) {
    await Promise.race([
      fonts.ready,
      new Promise((resolve) => setTimeout(resolve, 1500))
    ]);
  }

  const pendingImages = Array.from(document.images).filter((img) => !img.complete);
  if (pendingImages.length === 0) return;

  await Promise.race([
    Promise.all(
      pendingImages.map(
        (img) =>
          new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          })
      )
    ),
    new Promise((resolve) => setTimeout(resolve, 2000))
  ]);
}

/** 两次 rAF：确保样式重算与布局在打印前已经完成 */
function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/**
 * 触发浏览器打印（用户在对话框中选择“另存为 PDF”）。
 * 打印期间临时改写 document.title，使默认文件名与简历标题一致。
 */
export async function triggerPrintPdf(resumeTitle: string = '我的简历'): Promise<void> {
  const originalTitle = document.title;
  const cleanTitle = (resumeTitle || '我的简历')
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]/g, '_');

  let restored = false;
  const restoreTitle = () => {
    if (restored) return;
    restored = true;
    document.title = originalTitle;
  };

  // afterprint 是标准事件；部分浏览器不触发，用超时兜底
  window.addEventListener('afterprint', restoreTitle, { once: true });
  const fallback = setTimeout(restoreTitle, 60_000);

  try {
    await waitForAssets();
    await nextPaint();
    document.title = cleanTitle;
    window.print();
  } finally {
    clearTimeout(fallback);
    // 打印对话框是同步阻塞的；用户取消后也应尽快恢复标题
    setTimeout(restoreTitle, 0);
  }
}
