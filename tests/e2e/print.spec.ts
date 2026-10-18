import { test, expect } from './fixtures/mockApi';

/** 拦截 window.print，避免真的打开系统打印对话框 */
async function stubPrint(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    (window as any).__printCalls = 0;
    (window as any).__printTitles = [];
    window.print = () => {
      (window as any).__printCalls += 1;
      (window as any).__printTitles.push(document.title);
    };
  });
}

const printCalls = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as any).__printCalls as number);

test.describe('PDF 导出 @s0', () => {
  test('编辑器导出只触发浏览器打印，不发云端请求 @s0', async ({ page, mockApi }) => {
    await stubPrint(page);
    await page.goto('/editor/new');
    await page.waitForURL(/\/editor\/local_/);
    await expect(page.locator('.resume-doc')).toBeVisible();

    await page.getByRole('button', { name: /导出 PDF/ }).click();

    await expect.poll(() => printCalls(page)).toBe(1);

    // 打印时 document.title 使用简历标题，便于“另存为 PDF”得到正确文件名
    const titles = await page.evaluate(() => (window as any).__printTitles as string[]);
    expect(titles[0]).toBeTruthy();
    expect(titles[0]).not.toContain('.pdf');

    // 云端导出接口已下线：不允许任何 /api/export-pdf 请求
    expect(mockApi.requests.filter((r) => r.path.includes('export-pdf'))).toHaveLength(0);
  });

  test('分享页下载按钮同样走原生打印并上报下载 @s0', async ({ page, mockApi }) => {
    await stubPrint(page);
    mockApi.seed({ id: 'res_print', isPublic: 1, title: '打印测试简历' });

    await page.goto('/share/res_print');
    await expect(page.locator('.resume-doc')).toBeVisible();

    await page.getByRole('button', { name: /另存为 PDF/ }).click();
    await expect.poll(() => printCalls(page)).toBe(1);

    await expect
      .poll(() => mockApi.count('POST', '/api/share/res_print/visit'))
      .toBeGreaterThan(0);

    const downloadReport = mockApi
      .find('POST', '/api/share/res_print/visit')
      .find((r) => (r.body as { isDownloaded?: boolean } | null)?.isDownloaded === true);
    expect(downloadReport).toBeTruthy();
  });
});
