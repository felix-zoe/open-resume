import { test, expect } from './fixtures/mockApi';

test.describe('编辑器壳层 @s1', () => {
  test('排版设置以抽屉打开，Esc 可关闭 @s1', async ({ page }) => {
    await page.goto('/editor/demo');

    await page.getByRole('button', { name: '排版设置' }).click();
    const drawer = page.getByRole('dialog', { name: '排版与样式调优' });
    await expect(drawer).toBeVisible();

    // 关闭按钮有可访问名称
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('模板弹窗 Esc 关闭且保留当前模板 @s1', async ({ page }) => {
    await page.goto('/editor/demo');

    await page.getByRole('button', { name: '切换模板' }).click();
    const dialog = page.getByRole('dialog', { name: '选择简历排版模板' });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // 未选择时不应改变模板
    await expect(page.locator('.classic-template')).toBeVisible();
  });

  test('切换模板后画布立即更新 @s1', async ({ page }) => {
    await page.goto('/editor/demo');

    await page.getByRole('button', { name: '切换模板' }).click();
    await page.getByRole('button', { name: /现代双栏型/ }).click();

    // 模板弹窗里也有真实的模板缩略图，`.modern-template` 会命中多个元素，
    // 因此把断言限定在画布纸张内，验证的是「预览区已切换」而不是「某处存在该类名」
    await expect(page.locator('.a4-page .modern-template')).toBeVisible();
    await expect(page.getByRole('dialog', { name: '选择简历排版模板' })).toBeHidden();
  });

  test('岗位诊断只做关键词对照，不宣称通过率 @s1', async ({ page }) => {
    await page.goto('/editor/demo');

    await page.getByRole('button', { name: '岗位诊断' }).click();
    const dialog = page.getByRole('dialog', { name: '岗位 JD 关键词对照' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('内容仅在浏览器本地计算')).toBeVisible();

    // 填入示例 JD 并分析
    await dialog.getByRole('button', { name: '填入示例 JD' }).click();

    // 只给「关键词覆盖」这类可解释的指标，不再有 0–100 的单一匹配分
    await expect(dialog.getByText('关键词覆盖', { exact: true })).toBeVisible();
    await expect(dialog.getByText('匹配分')).toHaveCount(0);

    // 缺失关键词只展示、不可点击写入技能栏
    const missingSection = dialog.locator('div', { hasText: 'JD 提到但简历缺失' }).last();
    await expect(missingSection.locator('button')).toHaveCount(0);

    // 页面任何位置都不应出现“通过率极高”这类承诺
    await expect(page.getByText(/通过率极高|ATS 评分/)).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});
