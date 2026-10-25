import { test, expect, collectPageErrors } from './fixtures/mockApi';
import type { Page } from '@playwright/test';

/** 与 a11y.spec.ts 同一套注入：直接写登录态，跳过表单 */
async function login(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('open_resume_token', 'test-token');
    localStorage.setItem(
      'open_resume_user',
      JSON.stringify({ id: 'usr_test', email: 'test@example.com', nickname: '测试用户' })
    );
  });
}

test.describe('账号设置 @s1', () => {
  test('未登录访问设置页被重定向到登录 @s0', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForURL(/\/login\?redirect=%2Fsettings|\/login\?redirect=\/settings/);
    expect(page.url()).toContain('/login');
  });

  test('已登录可看到账号信息与三块设置 @s1', async ({ page }) => {
    await login(page);
    const errors = collectPageErrors(page);
    await page.goto('/settings');

    await expect(page.getByRole('heading', { level: 1, name: '账号设置' })).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: 'test@example.com' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '修改密码' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '导出我的数据' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '注销账号' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('两次新密码不一致时就地报错且不发请求 @s1', async ({ page, mockApi }) => {
    await login(page);
    await page.goto('/settings');

    await page.locator('#settings-current-password').fill('secret123');
    await page.locator('#settings-new-password').fill('newsecret1');
    await page.locator('#settings-confirm-password').fill('newsecret2');
    await page.getByRole('button', { name: '更新密码' }).click();

    await expect(page.getByText('两次输入的新密码不一致')).toBeVisible();
    expect(mockApi.count('POST', '/api/auth/password')).toBe(0);
  });

  test('当前密码错误时展示服务端错误 @s1', async ({ page, mockApi }) => {
    await login(page);
    await page.goto('/settings');

    await page.locator('#settings-current-password').fill('wrong-password');
    await page.locator('#settings-new-password').fill('newsecret1');
    await page.locator('#settings-confirm-password').fill('newsecret1');
    await page.getByRole('button', { name: '更新密码' }).click();

    await expect(page.getByText('当前密码不正确')).toBeVisible();
    expect(mockApi.password).toBe('secret123');
  });

  test('改密成功后清空输入，且新密码在登录时生效 @s1', async ({ page, mockApi }) => {
    await login(page);
    await page.goto('/settings');

    await page.locator('#settings-current-password').fill('secret123');
    await page.locator('#settings-new-password').fill('newsecret1');
    await page.locator('#settings-confirm-password').fill('newsecret1');
    await page.getByRole('button', { name: '更新密码' }).click();

    await expect(page.getByText('密码已更新，下次登录请使用新密码')).toBeVisible();
    await expect(page.locator('#settings-current-password')).toHaveValue('');
    expect(mockApi.password).toBe('newsecret1');
  });

  test('导出触发 JSON 下载，文件名带邮箱与日期 @s1', async ({ page, mockApi }) => {
    await login(page);
    mockApi.seed({ id: 'res_export', title: '导出用简历' });
    await page.goto('/settings');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '导出为 JSON' }).click()
    ]);

    expect(download.suggestedFilename()).toMatch(/^openresume-test-example-com-\d{4}-\d{2}-\d{2}\.json$/);
  });

  test('注销必须输入完整邮箱，否则不发请求 @s1', async ({ page, mockApi }) => {
    await login(page);
    await page.goto('/settings');

    await page.locator('#settings-confirm-email').fill('wrong@example.com');
    await page.getByRole('button', { name: '申请注销账号' }).click();

    await expect(page.getByText('请输入完整账号邮箱以确认注销')).toBeVisible();
    expect(mockApi.count('POST', '/api/auth/deletion')).toBe(0);
  });

  test('注销需二次确认，确认后进入冷静期并可撤销 @s1', async ({ page, mockApi }) => {
    await login(page);
    await page.goto('/settings');

    await page.locator('#settings-confirm-email').fill('test@example.com');
    await page.getByRole('button', { name: '申请注销账号' }).click();

    // 二次确认弹窗
    await expect(page.getByText('确认注销账号？')).toBeVisible();
    await page.getByRole('button', { name: '提交注销申请' }).click();

    // 进入冷静期：横幅出现，按钮禁用
    await expect(page.getByText('账号已进入注销冷静期')).toBeVisible();
    await expect(page.getByRole('button', { name: '已在冷静期中' })).toBeDisabled();
    expect(mockApi.deletionRequestedAt).not.toBeNull();

    // 撤销后恢复
    await page.getByRole('button', { name: '撤销注销' }).click();
    await expect(page.getByText('账号已进入注销冷静期')).toBeHidden();
    expect(mockApi.deletionRequestedAt).toBeNull();
  });

  test('冷静期内登录会自动撤销注销 @s1', async ({ page, mockApi }) => {
    mockApi.deletionRequestedAt = Math.floor(Date.now() / 1000) - 86400;
    await page.goto('/login');

    await page.getByPlaceholder('name@example.com').fill('test@example.com');
    await page.getByPlaceholder('至少 6 位字符').fill('secret123');
    await page.getByRole('button', { name: '立即登录' }).click();
    await page.waitForURL('**/dashboard');

    expect(mockApi.deletionRequestedAt).toBeNull();
  });

  test('导航菜单里有账号设置入口 @s1', async ({ page }) => {
    await login(page);
    await page.goto('/');

    await page.locator('nav button').filter({ hasText: '测试用户' }).click();
    await page.getByRole('link', { name: '账号设置' }).click();
    await page.waitForURL('**/settings');
    await expect(page.getByRole('heading', { level: 1, name: '账号设置' })).toBeVisible();
  });
});
