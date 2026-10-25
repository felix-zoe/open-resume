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

    // 四步新建：模板 → 起点 → 命名 → 确认
    await page.getByRole('button', { name: '新建第一份简历' }).click();
    const dialog = page.getByRole('dialog', { name: '新建一份简历' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: /现代双栏型/ }).click();
    await dialog.getByRole('button', { name: '下一步' }).click();

    // 起点：空白 / 示例数据 / 复制已有（空列表时不可选）
    await expect(dialog.getByRole('button', { name: /空白简历/ })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /复制已有简历/ })).toBeDisabled();
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

  test('新建时可从已有简历复制内容 @s1', async ({ page, mockApi }) => {
    await login(page);
    mockApi.seed({ id: 'res_src', title: '源简历', templateId: 'geek' });
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: '源简历' })).toBeVisible();

    await page.getByRole('button', { name: '新建简历' }).click();
    const dialog = page.getByRole('dialog', { name: '新建一份简历' });
    await dialog.getByRole('button', { name: '下一步' }).click();

    // 有简历后「复制已有」可选，选中后自动带出源简历的模板与名称
    await dialog.getByRole('button', { name: /复制已有简历/ }).click();
    await expect(dialog.getByLabel('从哪一份复制')).toHaveValue('res_src');
    await dialog.getByRole('button', { name: '下一步' }).click();

    const titleInput = dialog.getByPlaceholder('如：前端工程师-张小凡');
    await expect(titleInput).toHaveValue('源简历 - 副本');
    await dialog.getByRole('button', { name: '下一步' }).click();
    await dialog.getByRole('button', { name: '创建并编辑' }).click();

    await page.waitForURL(/\/editor\/res_/);
    const created = mockApi.find('POST', '/api/resumes')[0];
    expect(created.body).toMatchObject({ templateId: 'geek' });
    // 内容来自源简历，而不是默认范文
    expect(JSON.stringify(created.body)).toContain('张小凡');
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

  test('卡片展示模板缩略图与完整度进度条 @s1', async ({ page, mockApi }) => {
    await login(page);
    mockApi.seed({
      id: 'res_partial',
      title: '待完善简历',
      templateId: 'modern',
      completeness: { score: 60, missing: ['summary', 'metric', 'skills'] }
    });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: '待完善简历' })).toBeVisible();

    const card = page.locator('div.bg-white', { hasText: '待完善简历' }).first();
    // 缩略图是纯 CSS 的，只断言存在且对读屏隐藏
    await expect(card.locator('.resume-thumb')).toHaveCount(1);
    await expect(card.locator('.resume-thumb')).toHaveAttribute('aria-hidden', 'true');

    await expect(card.getByText('完整度')).toBeVisible();
    await expect(card.getByText('60%')).toBeVisible();
    // 缺失项映射成中文，且只提示前两项，避免卡片被撑高
    await expect(card.getByText('还缺 个人简介、量化数据')).toBeVisible();
    await expect(card.getByText('技能')).toHaveCount(0);
  });

  test('可在网格与列表视图间切换，偏好本地记住 @s1', async ({ page, mockApi }) => {
    await login(page);
    mockApi.seed({ id: 'res_v1', title: '简历一' });
    mockApi.seed({ id: 'res_v2', title: '简历二' });

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: '简历一' })).toBeVisible();

    const grid = page.getByRole('button', { name: '网格视图' });
    const list = page.getByRole('button', { name: '列表视图' });
    await expect(grid).toHaveAttribute('aria-pressed', 'true');

    await list.click();
    await expect(list).toHaveAttribute('aria-pressed', 'true');
    await expect(grid).toHaveAttribute('aria-pressed', 'false');
    // 列表模式仍保留完整数据，只是省掉统计区块
    await expect(page.getByRole('heading', { name: '简历一' })).toBeVisible();
    await expect(page.getByText('完整度 100%')).toHaveCount(2);

    await page.reload();
    await expect(page.getByRole('button', { name: '列表视图' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: '网格视图' }).click();
    await expect(page.getByRole('button', { name: '网格视图' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('列表只发 1 次列表 + 1 次汇总，不再 N+1 @s1', async ({ page, mockApi }) => {    await login(page);
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
