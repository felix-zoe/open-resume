import { test, expect } from './fixtures/mockApi';

/** 读取 store 写入的草稿，验证“离开再回来”后的持久化 */
async function readDraft(page: import('@playwright/test').Page, id: string) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(`open_resume_draft:${key}`);
    return raw ? JSON.parse(raw) : null;
  }, id);
}

test.describe('游客草稿 @s0', () => {
  test('demo 编辑后离开再进入内容仍在 @s0', async ({ page }) => {
    await page.goto('/editor/demo');
    await expect(page.locator('.resume-doc')).toBeVisible();

    const nameInput = page.getByPlaceholder('如：张小凡');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('张三丰');

    // 等待防抖保存落盘（store 内为 2500ms）
    await expect
      .poll(async () => (await readDraft(page, 'demo'))?.content?.profile?.name, { timeout: 8000 })
      .toBe('张三丰');

    await page.goto('/');
    await page.goto('/editor/demo');

    await expect(page.getByPlaceholder('如：张小凡')).toHaveValue('张三丰');
    await expect(page.locator('.resume-doc')).toContainText('张三丰');
  });

  test('?fresh=1 会重置 demo 草稿 @s0', async ({ page }) => {
    await page.goto('/editor/demo');
    const nameInput = page.getByPlaceholder('如：张小凡');
    await nameInput.fill('李四');
    await expect
      .poll(async () => (await readDraft(page, 'demo'))?.content?.profile?.name, { timeout: 8000 })
      .toBe('李四');

    await page.goto('/editor/demo?fresh=1');
    await expect(nameInput).not.toHaveValue('李四');
  });

  test('/editor/new 每次生成独立的本地草稿 @s0', async ({ page }) => {
    await page.goto('/editor/new');
    await page.waitForURL(/\/editor\/local_/);
    const firstUrl = page.url();
    const firstId = new URL(firstUrl).pathname.split('/').pop()!;

    await page.goto('/editor/new');
    await page.waitForURL(/\/editor\/local_/);
    const secondId = new URL(page.url()).pathname.split('/').pop()!;

    expect(firstId).not.toBe(secondId);
    expect(firstId.startsWith('local_')).toBe(true);
    expect(secondId.startsWith('local_')).toBe(true);

    // 两份草稿各自独立落盘
    const firstDraft = await readDraft(page, firstId);
    expect(firstDraft?.id).toBe(firstId);
  });

  test('模板参数在新建时生效 @s0', async ({ page }) => {
    await page.goto('/editor/new?template=modern');
    await page.waitForURL(/\/editor\/local_/);
    await expect(page.locator('.modern-template')).toBeVisible();
  });
});
