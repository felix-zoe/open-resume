import { test, expect } from './fixtures/mockApi';

test.describe('全局 401 @s0', () => {
  test('云端接口 401 时清理登录态并跳转登录页 @s0', async ({ page, mockApi }) => {
    // 预置登录态
    await page.addInitScript(() => {
      localStorage.setItem('open_resume_token', 'expired-token');
      localStorage.setItem(
        'open_resume_user',
        JSON.stringify({ id: 'usr_test', email: 'test@example.com', nickname: '测试用户' })
      );
    });
    mockApi.unauthorized = true;

    await page.goto('/dashboard');

    // 单次跳转，不来回抖动
    await page.waitForURL(/\/login\?redirect=/);

    const token = await page.evaluate(() => localStorage.getItem('open_resume_token'));
    expect(token).toBeNull();

    // redirect 参数保留原始位置，登录后可回到原页面
    expect(new URL(page.url()).searchParams.get('redirect')).toContain('/dashboard');
  });

  test('登录接口 401 不触发登出跳转 @s0', async ({ page, mockApi }) => {
    // mock 在 unauthorized 模式下让登录接口返回 401（密码错误）
    mockApi.unauthorized = true;
    await page.goto('/login');
    await page.getByPlaceholder('name@example.com').fill('test@example.com');
    await page.getByPlaceholder('至少 6 位字符').fill('wrongpass');
    await page.getByRole('button', { name: '立即登录' }).click();

    await expect(page.getByText('账号或密码错误')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/login');
  });
});
