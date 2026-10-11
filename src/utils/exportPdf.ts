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
  const targetElement = document.querySelector('.a4-print-target') as HTMLElement | null;

  if (!targetElement) {
    triggerPrintPdf(cleanTitle);
    return { success: true, mode: 'local', message: '已为您唤起本地超高清导出' };
  }

  try {
    // 1. 深度提取当前页面在内存中的所有已解析 CSS 样式规则 (包含 Tailwind 全量工具类与组件样式)
    let inlinedCss = '';
    try {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (sheet.cssRules) {
            for (const rule of Array.from(sheet.cssRules)) {
              inlinedCss += rule.cssText + '\n';
            }
          }
        } catch {
          // 遇到可能的跨域外部字体或 CDN 样式时静默捕获安全异常
        }
      }
    } catch (e) {
      console.warn('提取 CSS 规则失败:', e);
    }

    // 2. 将所有外部样式表转换为带当前完整 Origin 的绝对 URL 作为备选加载
    const linkedStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(link => {
        const href = link.getAttribute('href');
        if (!href) return '';
        try {
          const absoluteHref = new URL(href, window.location.origin).href;
          return `<link rel="stylesheet" href="${absoluteHref}">`;
        } catch {
          return link.outerHTML;
        }
      })
      .filter(Boolean)
      .join('\n');

    // 3. 抽取现有 <style> 标签
    const existingStyles = Array.from(document.querySelectorAll('style'))
      .map(s => s.outerHTML)
      .join('\n');

    // 4. 克隆画布 DOM 节点，并彻底剥离交互指示线 (如 .page-indicator-line 等 .no-print 元素)
    const clone = targetElement.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.no-print').forEach(el => el.remove());

    // 5. 组装 100% 真实纯净、完全自包含的独立 A4 渲染 HTML
    const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <base href="${window.location.origin}/">
    <title>${cleanTitle}</title>
    ${linkedStyles}
    ${existingStyles}
    <style id="inlined-extracted-styles">
      ${inlinedCss}
    </style>
    <style>
      @page {
        size: A4 portrait;
        margin: 0;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        width: 210mm !important;
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
    ${clone.outerHTML}
  </body>
</html>`;

    // 6. 请求云端无头 Chromium 渲染
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
