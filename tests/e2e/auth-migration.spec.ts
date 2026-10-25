import { test, expect } from './fixtures/mockApi';

/** 在编辑器里登录：打开「同步云端」弹窗，并在迁移选择框里确认同步 */
async function loginFromEditor(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /同步云端/ }).click();
  await expect(page.getByRole('heading', { name: /欢迎回到 OpenResume/ })).toBeVisible();
  await page.getByPlaceholder('name@example.com').fill('test@example.com');
  await page.getByPlaceholder('至少 6 位字符').fill('secret123');
  await page.getByRole('button', { name: '立即登录' }).click();

  // 登录后先问「同步到云端 / 仅保留本地」，选同步才迁移
  const choice = page.getByRole('dialog', { name: '这份本地草稿要同步到云端吗？' });
  await expect(choice).toBeVisible();
  await choice.getByRole('button', { name: /同步到云端/ }).click();
}

test.describe('登录迁移 @s0', () => {
  test('从本地草稿登录后 URL 变为云端 id 且刷新不丢内容 @s0', async ({ page, mockApi }) => {
    await page.goto('/editor/new');
    await page.waitForURL(/\/editor\/local_/);

    const nameInput = page.getByPlaceholder('如：张小凡');
    await nameInput.fill('迁移测试用户');

    await loginFromEditor(page);

    // URL 必须同步为云端 id，否则刷新会回到旧草稿
    await page.waitForURL(/\/editor\/res_/);
    const cloudId = new URL(page.url()).pathname.split('/').pop()!;
    expect(cloudId).toMatch(/^res_/);

    // 云端收到了一次创建请求，内容包含刚输入的名字
    const createRequest = mockApi
      .find('POST', '/api/resumes')
      .find((r) => JSON.stringify(r.body).includes('迁移测试用户'));
    expect(createRequest).toBeTruthy();

    // 刷新后仍是同一个 URL，且内容来自云端
    await page.reload();
    await expect(page.getByPlaceholder('如：张小凡')).toHaveValue('迁移测试用户');
    expect(new URL(page.url()).pathname.endsWith(cloudId)).toBe(true);
  });

  test('登录后 demo 草稿已迁出，不会被云端内容回写覆盖 @s0', async ({ page, mockApi }) => {
    await page.goto('/editor/demo');
    const nameInput = page.getByPlaceholder('如：张小凡');
    await nameInput.fill('示例草稿名字');

    await loginFromEditor(page);
    await page.waitForURL(/\/editor\/res_/);
    const cloudId = new URL(page.url()).pathname.split('/').pop()!;

    // 迁移成功后 demo 草稿 key 应被清理，避免下次进入 demo 又恢复旧内容
    const demoDraft = await page.evaluate(() => localStorage.getItem('open_resume_draft:demo'));
    expect(demoDraft).toBeNull();

    // 回到 demo 会重新展示预设，但不应把云端简历改回预设内容
    await page.goto('/editor/demo');
    await expect(nameInput).toHaveValue('张小凡');

    await page.goto(`/editor/${cloudId}`);
    await expect(nameInput).toHaveValue('示例草稿名字');
  });

  test('选择「仅保留本地」时不上传，草稿仍在浏览器里 @s0', async ({ page, mockApi }) => {
    await page.goto('/editor/new');
    await page.waitForURL(/\/editor\/local_/);
    const localUrl = page.url();
    await page.getByPlaceholder('如：张小凡').fill('只留本地的草稿');

    await page.getByRole('button', { name: /同步云端/ }).click();
    await page.getByPlaceholder('name@example.com').fill('test@example.com');
    await page.getByPlaceholder('至少 6 位字符').fill('secret123');
    await page.getByRole('button', { name: '立即登录' }).click();

    const choice = page.getByRole('dialog', { name: '这份本地草稿要同步到云端吗？' });
    await expect(choice).toBeVisible();
    await choice.getByRole('button', { name: /仅保留本地/ }).click();

    // 没有创建任何云端简历，URL 仍是本地草稿
    await expect.poll(() => mockApi.count('POST', '/api/resumes')).toBe(0);
    expect(page.url()).toBe(localUrl);
    await expect(page.getByPlaceholder('如：张小凡')).toHaveValue('只留本地的草稿');
  });

  test('没有本地草稿时登录不弹迁移选择 @s0', async ({ page, mockApi }) => {
    await page.goto('/login');
    await page.getByPlaceholder('name@example.com').fill('test@example.com');
    await page.getByPlaceholder('至少 6 位字符').fill('secret123');
    await page.getByRole('button', { name: '立即登录' }).click();

    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('dialog', { name: '这份本地草稿要同步到云端吗？' })).toHaveCount(0);
    // 也从没替用户凭空建一份默认内容的简历
    expect(mockApi.count('POST', '/api/resumes')).toBe(0);
  });

  test('登录/注册 Tab 与 URL 双向同步 @s0', async ({ page }) => {
    await page.goto('/login');
    const loginTab = page.getByRole('tab', { name: '账号登录' });
    const registerTab = page.getByRole('tab', { name: '免费注册' });

    await expect(loginTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: '登录您的账户' })).toBeVisible();

    // Tab → URL
    await registerTab.click();
    await page.waitForURL(/\/register$/);
    await expect(registerTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: '创建免费账户' })).toBeVisible();
    await expect(page.getByPlaceholder('如：极客小凡')).toBeVisible();

    // 直接访问 /register 时 Tab 也正确（URL → Tab）
    await page.goto('/register');
    await expect(page.getByRole('tab', { name: '免费注册' })).toHaveAttribute('aria-selected', 'true');

    // 切回登录不新增历史记录（replace）
    const historyLength = await page.evaluate(() => history.length);
    await page.getByRole('tab', { name: '账号登录' }).click();
    await page.waitForURL(/\/login$/);
    expect(await page.evaluate(() => history.length)).toBe(historyLength);
  });

  test('注册入口可创建账号并进入 dashboard @s0', async ({ page, mockApi }) => {
    await page.goto('/register');
    await page.getByPlaceholder('如：极客小凡').fill('新用户');
    await page.getByPlaceholder('name@example.com').fill('new@example.com');
    await page.getByPlaceholder('至少 6 位字符').fill('secret123');
    // 注册必须先勾选服务条款与隐私政策
    await page.getByRole('checkbox', { name: /服务条款/ }).check();
    await page.getByRole('button', { name: '创建免费账号' }).click();

    await page.waitForURL(/\/dashboard/);
    expect(mockApi.count('POST', '/api/auth/register')).toBe(1);
    expect(mockApi.find('POST', '/api/auth/register')[0].body).toMatchObject({
      email: 'new@example.com',
      nickname: '新用户'
    });
  });

  test('从登录页登录后跳转 dashboard @s0', async ({ page, mockApi }) => {
    mockApi.seed({ id: 'res_a', title: '已存在的简历' });

    await page.goto('/login');
    await page.getByPlaceholder('name@example.com').fill('test@example.com');
    await page.getByPlaceholder('至少 6 位字符').fill('secret123');
    await page.getByRole('button', { name: '立即登录' }).click();

    await page.waitForURL(/\/dashboard/);
    await expect(page.getByText('已存在的简历')).toBeVisible();
  });
});
