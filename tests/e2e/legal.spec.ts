import { test, expect, collectPageErrors } from './fixtures/mockApi';

test.describe('合规页面 @s1', () => {
  test('隐私政策与服务条款可直接访问且互相链接 @s1', async ({ page }) => {
    const errors = collectPageErrors(page);

    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: '隐私政策', level: 1 })).toBeVisible();
    await expect(page.getByText('生效日期：2026-10-24')).toBeVisible();

    // 政策必须说清「不接入第三方统计」这类可验证的事实
    await expect(page.getByText('不接入第三方统计、广告或用户画像服务')).toBeVisible();

    // 注销已实现，政策不能再写「尚未开放」——文案落后于代码会构成误导
    await expect(page.getByText('账号注销功能尚未开放')).toHaveCount(0);
    await expect(page.getByRole('link', { name: '账号设置' }).first()).toHaveAttribute('href', '/settings');
    await expect(page.getByText('7 天冷静期')).toBeVisible();

    await page.getByRole('link', { name: '服务条款' }).click();
    await page.waitForURL(/\/terms$/);
    await expect(page.getByRole('heading', { name: '服务条款', level: 1 })).toBeVisible();

    // 条款里回链隐私政策
    await page.getByRole('link', { name: '隐私政策' }).first().click();
    await page.waitForURL(/\/privacy$/);

    expect(errors).toEqual([]);
  });

  test('首页页脚有法律与示例链接 @s1', async ({ page }) => {
    await page.goto('/');

    const footerNav = page.getByRole('navigation', { name: '站点导航' });
    await expect(footerNav.getByRole('link', { name: '隐私政策' })).toBeVisible();
    await expect(footerNav.getByRole('link', { name: '服务条款' })).toBeVisible();
    // 示例库是公开可索引的营销页，页脚必须能到达
    await expect(footerNav.getByRole('link', { name: '简历示例' })).toBeVisible();
  });

  test('注册未勾选条款时提交被拦下且不发请求 @s0', async ({ page, mockApi }) => {
    await page.goto('/register');
    await page.getByPlaceholder('如：极客小凡').fill('未同意用户');
    await page.getByPlaceholder('name@example.com').fill('noagree@example.com');
    await page.getByPlaceholder('至少 6 位字符').fill('secret123');

    await page.getByRole('button', { name: '创建免费账号' }).click();

    await expect(page.getByText('请先阅读并勾选服务条款与隐私政策')).toBeVisible();
    expect(mockApi.count('POST', '/api/auth/register')).toBe(0);

    // 勾选后即可正常提交
    await page.getByRole('checkbox', { name: /服务条款/ }).check();
    await page.getByRole('button', { name: '创建免费账号' }).click();
    await page.waitForURL(/\/dashboard/);
    expect(mockApi.count('POST', '/api/auth/register')).toBe(1);
  });

  test('登录不要求勾选条款 @s1', async ({ page, mockApi }) => {
    await page.goto('/login');
    await page.getByPlaceholder('name@example.com').fill('test@example.com');
    await page.getByPlaceholder('至少 6 位字符').fill('secret123');
    await page.getByRole('button', { name: '立即登录' }).click();

    await page.waitForURL(/\/dashboard/);
    expect(mockApi.count('POST', '/api/auth/login')).toBe(1);
  });
});
