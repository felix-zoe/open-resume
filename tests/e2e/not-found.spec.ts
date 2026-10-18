import { test, expect, collectPageErrors } from './fixtures/mockApi';

test.describe('404 与静态资源 @s0', () => {
  test('未知路由渲染 404 且首页入口可用 @s0', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto('/nope/definitely-missing');

    await expect(page.getByText('这个页面不存在')).toBeVisible();
    await expect(page.getByRole('link', { name: /返回首页/ })).toBeVisible();

    await page.getByRole('link', { name: /返回首页/ }).click();
    await page.waitForURL('**/');
    await expect(page.locator('body')).toContainText('OpenResume');

    expect(errors).toEqual([]);
  });

  test('favicon 可访问 @s0', async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/favicon.svg`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('svg');
  });

  test('index.html 包含 SEO 元信息 @s0', async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/`);
    const html = await response.text();

    expect(html).toContain('name="description"');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('/favicon.svg');
  });
});
