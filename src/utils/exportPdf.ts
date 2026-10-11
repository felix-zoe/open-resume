/**
 * 高保真矢量 PDF 导出驱动器 (双引擎高可用体系)
 * 优先通道：调用云端无头 Chromium 引擎 (/api/export-pdf)，一键静默生成并下载真正 100% 矢量的 PDF，无需打印弹窗
 * 保底通道：本地纯净 @media print 原生打印驱动，网络异常或离线无头服务时平滑降级
 */

export function triggerPrintPdf(resumeTitle: string = '我的简历') {
  const originalTitle = document.title;
  try {
    document.title = (resumeTitle || '我的简历').replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]/g, '_');
    window.print();
  } finally {
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  }
}

export async function exportResumePdf(resumeTitle: string = '我的简历'): Promise<{
  success: boolean;
  mode: 'cloud' | 'local';
  message: string;
}> {
  const cleanTitle = (resumeTitle || '我的简历').replace(/\.pdf$/i, '').replace(/[\\/:*?"<>|]/g, '_');
  const targetElement = document.querySelector('.a4-print-target');

  if (!targetElement) {
    triggerPrintPdf(cleanTitle);
    return { success: true, mode: 'local', message: '已为您唤起本地超高清导出' };
  }

  try {
    // 1. 抽取当前页面全部样式与 Tailwind 规范
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');

    // 2. 组装 100% 真实纯净的独立 A4 渲染 HTML
    const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${cleanTitle}</title>
    ${styles}
    <style>
      @page {
        size: A4 portrait;
        margin: 0;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .a4-print-target {
        transform: none !important;
        box-shadow: none !important;
        border: none !important;
        margin: 0 auto !important;
        width: 210mm !important;
        min-height: 297mm !important;
      }
      .no-print {
        display: none !important;
      }
      .resume-section-item {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    </style>
  </head>
  <body>
    <div style="width: 210mm; margin: 0 auto;">
      ${targetElement.outerHTML}
    </div>
  </body>
</html>`;

    // 3. 请求云端无头 Chromium 渲染
    const res = await fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: fullHtml, title: cleanTitle })
    });

    if (res.ok && res.headers.get('content-type')?.includes('application/pdf')) {
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${cleanTitle}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      return {
        success: true,
        mode: 'cloud',
        message: '已在云端完成高保真矢量渲染，PDF 正在保存至本地！'
      };
    }

    // 若云端未开启 Browser Run 绑定或返回非 200，触发平滑降级
    console.warn('云端无头服务响应异常，平滑降级至本地打印通道:', res.status);
    triggerPrintPdf(cleanTitle);
    return {
      success: true,
      mode: 'local',
      message: '云端引擎就绪中，已为您平滑启动高保真本地导出通道'
    };
  } catch (err) {
    console.warn('网络或环境异常，平滑降级至本地打印通道:', err);
    triggerPrintPdf(cleanTitle);
    return {
      success: true,
      mode: 'local',
      message: '已为您平滑启动高保真本地导出通道'
    };
  }
}
