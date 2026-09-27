/**
 * 高保真矢量 PDF 导出驱动器
 * 利用现代浏览器 @media print 原生打印引擎，导出纯矢量、文字可选、外链可点的超高清 PDF
 */

export function triggerPrintPdf(resumeTitle: string = '我的简历') {
  const originalTitle = document.title;
  try {
    // 动态将网页标题临时修改为简历文件名，浏览器另存为 PDF 时会自动采纳此名字
    document.title = `${resumeTitle}.pdf`.replace(/[\\/:*?"<>|]/g, '_');
    window.print();
  } finally {
    // 打印对话框关闭后还原标题
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  }
}
