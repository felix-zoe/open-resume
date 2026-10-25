import { test, expect } from './fixtures/mockApi';
import type { Page } from '@playwright/test';

async function login(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('open_resume_token', 'test-token');
    localStorage.setItem(
      'open_resume_user',
      JSON.stringify({ id: 'usr_test', email: 'test@example.com', nickname: '测试用户' })
    );
  });
}

test.describe('简历语言 @s1', () => {
  test('排版设置里切换语言后，预览标题与日期立即变化 @s1', async ({ page }) => {
    await page.goto('/editor/demo');
    const doc = page.locator('.resume-doc');
    await expect(doc).toContainText('工作经历');

    // 桌面端：排版设置抽屉
    await page.getByRole('button', { name: '排版设置' }).click();
    const localeGroup = page.getByRole('group', { name: '简历语言' });
    await expect(localeGroup).toBeVisible();

    await localeGroup.getByRole('button', { name: /English/ }).click();

    await expect(doc).toContainText('Work Experience');
    await expect(doc).not.toContainText('工作经历');
    // 日期跟着换成 MM/YYYY
    await expect(doc).toContainText('07/2022');
  });

  test('语言切换不改写用户输入的内容 @s1', async ({ page }) => {
    await page.goto('/editor/demo');

    // 用姓名输入框最稳：它的 placeholder 是固定的
    const nameInput = page.getByPlaceholder('如：张小凡');
    await nameInput.fill('张三丰');

    await page.getByRole('button', { name: '排版设置' }).click();
    await page.getByRole('group', { name: '简历语言' }).getByRole('button', { name: /English/ }).click();

    await expect(page.locator('.resume-doc')).toContainText('张三丰');
    await expect(nameInput).toHaveValue('张三丰');
  });

  test('切换后刷新仍保持英文（写进了 content.locale）@s1', async ({ page }) => {
    await page.goto('/editor/demo');
    await page.getByRole('button', { name: '排版设置' }).click();
    await page.getByRole('group', { name: '简历语言' }).getByRole('button', { name: /English/ }).click();

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const raw = localStorage.getItem('open_resume_draft:demo');
            return raw ? JSON.parse(raw)?.content?.locale : null;
          }),
        { timeout: 8000 }
      )
      .toBe('en');

    await page.reload();
    await expect(page.locator('.resume-doc')).toContainText('Work Experience');
  });

  test('游客新建时可选英文，编辑器直接是英文范文 @s1', async ({ page }) => {
    await page.goto('/editor/new?locale=en');
    await page.waitForURL(/\/editor\/local_/);

    // 游客入口给的是完整范文，切英文后范文本身也必须是英文
    const doc = page.locator('.resume-doc');
    await expect(doc).toContainText('Work Experience');
    await expect(doc).toContainText('Alex Zhang');
    await expect(doc).not.toContainText('工作经历');
    await expect(doc).not.toContainText('张小凡');
  });

  test('登录用户新建英文示例简历：内容与标题都是英文 @s1', async ({ page, mockApi }) => {
    await login(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /新建简历/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // 第 1 步：模板
    await dialog.getByRole('button', { name: /经典通用型/ }).click();
    await dialog.getByRole('button', { name: '下一步' }).click();

    // 第 2 步：起点 + 语言
    await dialog.getByRole('button', { name: /示例数据/ }).click();
    await dialog.getByRole('group', { name: '简历语言' }).getByRole('button', { name: /English/ }).click();
    await dialog.getByRole('button', { name: '下一步' }).click();

    // 第 3 步：命名
    const titleInput = dialog.getByPlaceholder('如：前端工程师-张小凡');
    await titleInput.fill('Senior Frontend - Alex');
    await dialog.getByRole('button', { name: '下一步' }).click();

    // 第 4 步：确认
    await dialog.getByRole('button', { name: '创建并编辑' }).click();

    const created = mockApi.find('POST', '/api/resumes')[0];
    expect(created).toBeTruthy();
    expect(created.body.content.locale).toBe('en');
    expect(created.body.content.modules.work.title).toBe('Work Experience');
    expect(created.body.content.profile.name).toBe('Alex Zhang');
  });
});
