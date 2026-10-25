import { test, expect, collectPageErrors } from './fixtures/mockApi';

test.describe('smoke @s0', () => {
  test('home page renders without runtime errors', async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto('/');

    // 页面里有两个 nav（顶部导航与页脚法律链接），这里只验证顶部导航
    await expect(page.getByRole('navigation').first()).toContainText('OpenResume');
    await expect(page.locator('h1').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('unknown route does not crash the app @s0', async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto('/this-route-does-not-exist');

    // Sprint 0 结束前该路由会重定向到首页；此处只要求不白屏、不抛错
    await expect(page.locator('#app')).not.toBeEmpty();
    expect(errors).toEqual([]);
  });
});
