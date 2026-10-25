import { test, expect, type Page } from './fixtures/mockApi';

/**
 * AI 改写（T5.7）。
 *
 * 覆盖的是这个功能最要紧的三条承诺，而不是「模型答得好不好」：
 * 1. 没配置 Key 时不假装能用，而是引导去配；
 * 2. 改写结果**必须过 diff 才会写回正文**，放弃则一字不动；
 * 3. 请求走本站转发，**不带登录态**（带了就等于「埋点接口能拿到身份」）。
 */

const AI_CONFIG_KEY = 'open_resume_ai_config';

/** 预置一份已配置好的 AI 设置，跳过接入表单 */
async function seedAiConfig(page: Page, overrides: Record<string, unknown> = {}) {
  await page.addInitScript(
    ([key, config]) => {
      localStorage.setItem(key, JSON.stringify(config));
    },
    [
      AI_CONFIG_KEY,
      {
        providerId: 'deepseek',
        baseUrl: '',
        models: { deepseek: 'deepseek-chat' },
        keys: { deepseek: 'sk-test-key-123456' },
        rememberKey: true,
        ...overrides
      }
    ] as const
  );
}

async function openAiDrawer(page: Page) {
  await page.goto('/editor/demo');
  await page.getByRole('button', { name: 'AI 改写' }).click();
  return page.getByRole('dialog', { name: 'AI 改写' });
}

test.describe('AI 改写 @s1', () => {
  test('未配置时先引导接入，并说明 Key 不会被保存 @s1', async ({ page }) => {
    const drawer = await openAiDrawer(page);

    await expect(drawer.getByText('先接入一个模型')).toBeVisible();
    await expect(drawer.getByLabel('模型厂商')).toBeVisible();
    await expect(drawer.getByRole('button', { name: '测试连接' })).toBeVisible();

    // 隐私承诺必须写在用户填 Key 的地方，而不是藏在隐私政策里
    await expect(drawer.getByText(/不保存 Key，也不保存送去改写的内容/)).toBeVisible();

    // 没配好之前不该出现改写按钮
    await expect(drawer.getByRole('button', { name: '开始改写' })).toHaveCount(0);
  });

  test('改写请求走本站转发且不携带登录态 @s1', async ({ page, mockApi }) => {
    await seedAiConfig(page);
    const drawer = await openAiDrawer(page);

    mockApi.aiRewriteResult = '主导核心业务系统前端研发';
    await drawer.getByRole('button', { name: '开始改写' }).click();

    await expect.poll(() => mockApi.count('POST', '/api/ai/rewrite')).toBe(1);
    await expect(drawer.getByText('改动对照')).toBeVisible();

    const request = mockApi.find('POST', '/api/ai/rewrite')[0];
    // 自带 Key 的接口不需要账号，带上 token 只会扩大身份泄露面
    expect(request.authorization).toBeNull();

    const body = request.body as { text?: string; model?: string; apiKey?: string };
    expect(body.model).toBe('deepseek-chat');
    expect(body.apiKey).toBe('sk-test-key-123456');
    expect(body.text).toBeTruthy();
    // 只送用户选中的那一段，不是整份简历
    expect(body.text!.length).toBeLessThan(1000);
  });

  test('结果显示 diff，且必须点「采纳」才写回正文 @s1', async ({ page, mockApi }) => {
    await seedAiConfig(page);
    const drawer = await openAiDrawer(page);

    const rewritten = '主导核心业务系统前端研发与性能优化';
    mockApi.aiRewriteResult = rewritten;

    await drawer.getByRole('button', { name: '开始改写' }).click();
    await expect(drawer.getByText('改动对照')).toBeVisible();

    // 结果只是建议，未生效前有明确标注
    await expect(drawer.getByText('模型建议，尚未生效')).toBeVisible();
    await expect(drawer.getByText('换一版')).toBeVisible();

    // 采纳前：原文预览仍是原话（默认选中「个人简介」，第一个有内容的段落）
    await expect(drawer.getByText(/5年前端全栈开发经验/)).toBeVisible();

    await drawer.getByRole('button', { name: '采纳改写' }).click();

    // 采纳后：diff 收起，原文预览变成改写结果
    await expect(drawer.getByText('改动对照')).toHaveCount(0);
    await expect(drawer.getByText(rewritten, { exact: false })).toBeVisible();
  });

  test('点「放弃」不改动正文 @s1', async ({ page, mockApi }) => {
    await seedAiConfig(page);
    const drawer = await openAiDrawer(page);

    mockApi.aiRewriteResult = '换了措辞但用户不要';
    await drawer.getByRole('button', { name: '开始改写' }).click();
    await expect(drawer.getByText('改动对照')).toBeVisible();

    await drawer.getByRole('button', { name: '放弃' }).click();
    await expect(drawer.getByText('改动对照')).toHaveCount(0);
    await expect(drawer.getByText('换了措辞但用户不要')).toHaveCount(0);
  });

  test('服务商出错时给出可行动的提示，且不写入任何内容 @s1', async ({ page, mockApi }) => {
    await seedAiConfig(page);
    const drawer = await openAiDrawer(page);

    mockApi.aiError = { status: 502, code: 50201, message: 'API Key 无效，或没有该模型的调用权限' };
    await drawer.getByRole('button', { name: '开始改写' }).click();

    const alert = drawer.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('API Key 无效');
    // 失败时不该出现对照表，避免用户误以为有结果可采纳
    await expect(drawer.getByText('改动对照')).toHaveCount(0);
    await expect(drawer.getByRole('button', { name: '采纳改写' })).toHaveCount(0);
  });

  test('可以切换厂商并从服务商拉取模型列表 @s1', async ({ page, mockApi }) => {
    await seedAiConfig(page);
    const drawer = await openAiDrawer(page);

    await drawer.getByRole('button', { name: '设置' }).click();

    mockApi.aiModels = ['glm-4-flash', 'glm-4-plus'];
    await drawer.getByRole('button', { name: '拉取列表' }).click();
    await expect(drawer.getByText('拉到 2 个模型')).toBeVisible();
  });

  test('模型未填时不发起请求 @s1', async ({ page, mockApi }) => {
    // 火山方舟没有默认模型名，必须自己填接入点
    await seedAiConfig(page, { providerId: 'ark', models: {} });
    const drawer = await openAiDrawer(page);

    await expect(drawer.getByText('先接入一个模型')).toBeVisible();
    expect(mockApi.count('POST', '/api/ai/rewrite')).toBe(0);
  });
});