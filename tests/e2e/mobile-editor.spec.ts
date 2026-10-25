import { test, expect } from './fixtures/mockApi';
import type { Page } from '@playwright/test';

const MOBILE = { width: 375, height: 667 };
const DESKTOP = { width: 1280, height: 900 };

async function login(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('open_resume_token', 'test-token');
    localStorage.setItem(
      'open_resume_user',
      JSON.stringify({ id: 'usr_test', email: 'test@example.com', nickname: '测试用户' })
    );
  });
}

test.describe('编辑器响应式与缩放 @s1', () => {
  test('移动端 Tab 可在填写与预览间切换，编辑内容保留 @s1', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await login(page);
    await page.goto('/editor/new');
    await page.waitForURL(/\/editor\/local_/);

    // 默认在「填写内容」
    await expect(page.getByRole('tab', { name: '填写内容' })).toHaveAttribute('aria-selected', 'true');
    const nameInput = page.getByPlaceholder('如：张小凡');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('移动端测试');

    // 切到预览：表单隐藏，A4 纸张可见
    await page.getByRole('tab', { name: '预览排版' }).click();
    await expect(page.locator('.a4-print-target')).toBeVisible();
    await expect(nameInput).toBeHidden();
    await expect(page.locator('.a4-print-target')).toContainText('移动端测试');

    // 切回填写：内容与滚动状态保留
    await page.getByRole('tab', { name: '填写内容' }).click();
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue('移动端测试');
  });

  test('移动端隐藏缩放控件，更多菜单可打开模板弹窗 @s1', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/editor/demo');

    // 缩放控件只在 lg 以上出现
    await expect(page.getByTitle('放大')).toBeHidden();

    await page.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('menuitem', { name: '切换模板' }).click();

    await expect(page.getByText('选择简历排版模板')).toBeVisible();
    // 点击弹窗右上角关闭（键盘支持在 T1.9b 迁移到 AppModal 后补）
    await page.getByRole('button', { name: '关闭' }).click();
    await expect(page.getByText('选择简历排版模板')).toBeHidden();
  });

  test('移动端可完成打印导出 @s1', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.addInitScript(() => {
      (window as any).__printed = 0;
      window.print = () => {
        (window as any).__printed += 1;
      };
    });
    await page.goto('/editor/demo');

    // 移动端导出按钮只保留图标，用 aria-label 定位
    await page.getByRole('button', { name: '导出简历' }).click();

    // 格式弹窗在移动端同样可用，PDF 需再点「打开打印」
    const dialog = page.getByRole('dialog', { name: '导出简历' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '打开打印' }).click();

    await expect.poll(() => page.evaluate(() => (window as any).__printed)).toBe(1);
  });

  test('50% 与 150% 缩放下可完整滚动、无裁切 @s1', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/editor/demo');

    const wrapper = page.locator('.preview-canvas-wrapper');
    const paper = page.locator('.a4-print-target');

    const measure = async () => {
      const box = await paper.boundingBox();
      const scaler = await page.locator('.zoom-scaler').boundingBox();
      return { box, scaler };
    };

    // 100%
    const base = await measure();
    expect(base.box!.width).toBeCloseTo(793.7, 0);

    // 缩小到 50%：占位容器同步变小，内容不被裁切
    for (let i = 0; i < 5; i += 1) await page.getByTitle('缩小').click();
    await expect(page.locator('header').getByText('50%')).toBeVisible();
    const small = await measure();
    expect(small.box!.width).toBeCloseTo(793.7 * 0.5, 0);
    expect(small.scaler!.width).toBeCloseTo(793.7 * 0.5, 0);

    // 放大到 150%：占位容器变大，可横向滚动看到纸张右缘
    for (let i = 0; i < 10; i += 1) await page.getByTitle('放大').click();
    await expect(page.locator('header').getByText('150%')).toBeVisible();
    const large = await measure();
    expect(large.box!.width).toBeCloseTo(793.7 * 1.5, 0);
    expect(large.scaler!.width).toBeCloseTo(793.7 * 1.5, 0);

    // 纸张右缘可滚动到：内容宽度 = 纸张缩放宽度 + 两侧 padding（p-6 = 24px）
    const scrollWidth = await wrapper.evaluate((el) => el.scrollWidth);
    const clientWidth = await wrapper.evaluate((el) => el.clientWidth);
    expect(scrollWidth).toBeGreaterThan(clientWidth);
    expect(scrollWidth).toBeGreaterThanOrEqual(Math.round(793.7 * 1.5) + 48);

    // 滚到最右时纸张右缘仍在视口内（未被 flex 居中裁切）
    await wrapper.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    const box = await paper.boundingBox();
    const wrapperBox = await wrapper.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(wrapperBox!.x + wrapperBox!.width + 1);
  });

  test('移动端「排版样式」Tab 内联可调字号 @s1', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/editor/demo');

    await page.getByRole('tab', { name: '排版样式' }).click();
    const panel = page.getByRole('complementary', { name: '排版样式' });
    await expect(panel).toBeVisible();

    // 表单与预览都不在样式 Tab 里
    await expect(page.getByPlaceholder('如：张小凡')).toBeHidden();
    await expect(page.locator('.a4-print-target')).toBeHidden();

    // 调字号：值直接反映到 store 与滑块标签
    const slider = panel.getByLabel('正文字号');
    await slider.fill('15');
    await expect(panel.getByText('15px')).toBeVisible();

    // 切回预览，纸张仍在且未被样式面板挤走
    await page.getByRole('tab', { name: '预览排版' }).click();
    await expect(page.locator('.a4-print-target')).toBeVisible();
  });

  test('移动端底部固定导出条可打开格式弹窗 @s1', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/editor/demo');

    // 底部条在主区域内始终可见，不随 Tab 切换消失
    const bar = page.locator('main ~ div').filter({ hasText: '内容自动保存' });
    await expect(bar).toBeVisible();

    await page.getByRole('tab', { name: '预览排版' }).click();
    await expect(bar).toBeVisible();

    await bar.getByRole('button', { name: '导出' }).click();
    await expect(page.getByRole('dialog', { name: '导出简历' })).toBeVisible();
  });

  test('桌面端不显示移动 Tab @s1', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/editor/demo');

    await expect(page.getByRole('tab', { name: '填写内容' })).toHaveCount(0);
    await expect(page.getByPlaceholder('如：张小凡')).toBeVisible();
    await expect(page.locator('.a4-print-target')).toBeVisible();
    // 桌面端底部导出条不存在，导出只在 Header 里
    await expect(page.getByText('内容自动保存 · 导出后可直接投递')).toHaveCount(0);
  });
});
