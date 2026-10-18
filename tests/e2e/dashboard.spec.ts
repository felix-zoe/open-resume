import { test, expect } from './fixtures/mockApi';
import type { Page } from '@playwright/test';

/** 预置登录态（token 与 mock 一致） */
async function login(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('open_resume_token', 'test-token');
    localStorage.setItem(
      'open_resume_user',
      JSON.stringify({ id: 'usr_test', email: 'test@example.com', nickname: '测试用户' })
    );
  });
}

/** 打开某张卡片的“更多操作”菜单 */
async function openCardMenu(page: Page, title: string) {
  const card = page.locator('div.bg-white', { hasText: title }).first();
  await card.getByRole('button', { name: '更多操作' }).click();
  return card;
}

test.describe('Dashboard 看板 @s1', () => {
  test('新用户看到空态，新建流程落到编辑器 @s1', async ({ page, mockApi }) => {
    await login(page);
    await page.goto('/dashboard');

    await expect(page.getByText('还没有简历')).toBeVisible();

    // 三步新建：模板 → 命名 → 确认
    await page.getByRole('button', { name: '新建第一份简历' }).click();
    const dialog = page.getByRole('dialog', { name: '新建一份简历' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /现代双栏型/ }).click();
    await dialog.getByRole('button', { name: '下一步' }).click();

    await dialog.getByPlaceholder('如：前端工程师-张小凡').fill('前端工程师-李雷');
    await dialog.getByRole('button', { name: '下一步' }).click();

    await expect(dialog.getByText('前端工程师-李雷')).toBeVisible();
    await dialog.getByRole('button', { name: '创建并编辑' }).click();

    await page.waitForURL(/\/editor\/res_/);
    const created = mockApi.find('POST', '/api/resumes')[0];
    expect(created.body).toMatchObject({
      title: '前端工程师-李雷',
      templateId: 'modern'
    });
  });

  test('未登录访问看板被重定向到登录页并带回跳参数 @s1', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/dashboard');
  });

  test('重命名走 PATCH，刷新后仍在 @s1', async ({ page, mockApi }) => {
    await login(page);
    mockApi.seed({ id: 'res_r', title: '旧名字' });

    await page.goto('/dashboard');
    await expect(page.getByText('旧名字')).toBeVisible();

    await openCardMenu(page, '旧名字');
    await page.getByRole('menuitem', { name: '重命名' }).click();

    const dialog = page.getByRole('dialog', { name: '重命名简历' });
    const input = dialog.getByPlaceholder('如：前端工程师-张小凡');
    await input.fill('新名字');
    await dialog.getByRole('button', { name: '保存' }).click();

    await expect(page.getByText('新名字')).toBeVisible();
    const patch = mockApi.find('PATCH', '/api/resumes/res_r');
    expect(patch).toHaveLength(1);
    expect(patch[0].body).toEqual({ title: '新名字' });
    // 绝不能退化成 PUT（会覆盖正文）
    expect(mockApi.count('PUT', '/api/resumes/res_r')).toBe(0);

    await page.reload();
    await expect(page.getByText('新名字')).toBeVisible();
  });

  test('搜索防抖过滤与三种排序 @s1', async ({ page, mockApi }) => {
    await login(page);
    mockApi.seed({ id: 'res_a', title: '后端工程师', updatedAt: 1_700_000_300 });
    mockApi.seed({ id: 'res_b', title: '前端工程师', updatedAt: 1_700_000_200 });
    mockApi.seed({ id: 'res_c', title: '算法工程师', updatedAt: 1_700_000_100 });

    await page.goto('/dashboard');
    await expect(page.getByText('前端工程师')).toBeVisible();

    // 搜索：只保留匹配项
    await page.getByLabel('搜索简历名称').fill('前端');
    await expect(page.getByText('后端工程师')).toHaveCount(0);
    await expect(page.getByText('算法工程师')).toHaveCount(0);
    await expect(page.getByText('前端工程师')).toBeVisible();

    await page.getByLabel('搜索简历名称').fill('不存在的岗位');
    await expect(page.getByText('没有匹配的简历')).toBeVisible();
    await page.getByRole('button', { name: '清除搜索' }).click();
    await expect(page.getByText('后端工程师')).toBeVisible();

    // 排序：名称（localeCompare，中文按拼音）
    await page.getByLabel('排序方式').selectOption('title');
    const titles = page.locator('h2.truncate');
    await expect(titles).toHaveCount(3);
    const byName = await titles.allInnerTexts();
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN')));

    // 排序：更新时间
    await page.getByLabel('排序方式').selectOption('updated');
    await expect(titles.first()).toHaveText('后端工程师');

    // 排序：浏览量
    await page.getByLabel('排序方式').selectOption('views');
    await expect(titles).toHaveCount(3);
  });

  test('删除需确认，取消不删、确认才删 @s1', async ({ page, mockApi }) => {
    await login(page);
    mockApi.seed({ id: 'res_del', title: '待删除简历' });

    await page.goto('/dashboard');
    await expect(page.getByText('待删除简历')).toBeVisible();

    // 打开确认框 → 取消
    await openCardMenu(page, '待删除简历');
    await page.getByRole('menuitem', { name: '删除' }).click();

    const dialog = page.getByRole('dialog', { name: '删除这份简历？' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '取消' }).click();

    await expect(dialog).toBeHidden();
    expect(mockApi.count('DELETE', '/api/resumes/res_del')).toBe(0);
    await expect(page.getByText('待删除简历')).toBeVisible();

    // 再次打开 → 确认
    await openCardMenu(page, '待删除简历');
    await page.getByRole('menuitem', { name: '删除' }).click();
    await page
      .getByRole('dialog', { name: '删除这份简历？' })
      .getByRole('button', { name: '删除' })
      .click();

    await expect.poll(() => mockApi.count('DELETE', '/api/resumes/res_del')).toBe(1);
    await expect(page.getByText('待删除简历')).toHaveCount(0);
    await expect(page.getByText('还没有简历')).toBeVisible();
  });

  test('列表只发 1 次列表 + 1 次汇总，不再 N+1 @s1', async ({ page, mockApi }) => {
    await login(page);
    mockApi.seed({ id: 'res_1', title: '简历一' });
    mockApi.seed({ id: 'res_2', title: '简历二' });
    mockApi.seed({ id: 'res_3', title: '简历三' });

    await page.goto('/dashboard');
    await expect(page.getByText('简历三')).toBeVisible();

    expect(mockApi.count('GET', '/api/resumes')).toBe(1);
    expect(mockApi.count('GET', '/api/analytics/overview')).toBe(1);
    expect(mockApi.count('GET', '/api/resumes/res_1/analytics')).toBe(0);
    expect(mockApi.count('GET', '/api/resumes/res_2/analytics')).toBe(0);
  });
});
