import { test, expect, collectPageErrors } from './fixtures/mockApi';

test.describe('首页 @s1', () => {
  test('渲染四套真实模板预览，而不是骨架截图 @s1', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto('/');

    const previews = page.locator('#templates .template-preview');
    await expect(previews).toHaveCount(4);

    // 预览里挂载的是真实模板组件
    await expect(page.locator('#templates .classic-template')).toHaveCount(1);
    await expect(page.locator('#templates .geek-template')).toHaveCount(1);
    await expect(page.locator('#templates .modern-template')).toHaveCount(1);
    await expect(page.locator('#templates .ats-template')).toHaveCount(1);

    // 预览不可交互、对读屏隐藏（只是装饰）
    await expect(previews.first()).toHaveAttribute('aria-hidden', 'true');
    expect(errors).toEqual([]);
  });

  test('区块顺序为 Hero → 三步 → 模板 → 能力 → 岗位 → FAQ @s1', async ({ page }) => {
    await page.goto('/');

    // 首页是懒加载 chunk，先等第一个区块标题出现，再取全部标题
    await expect(page.locator('main h2.home-section-title').first()).toBeVisible();

    // 模板预览内部也有 h2（简历章节标题），这里只看页面级标题
    const headings = await page.locator('main h2.home-section-title').allInnerTexts();
    expect(headings).toEqual([
      '三步完成一份简历',
      '四套模板，覆盖常见岗位',
      '简历之外，真正影响投递的部分',
      '按岗位选择起点',
      '常见问题'
    ]);
  });

  test('删除了竞品对比表与绝对化用语 @s1', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('拒绝竞品套路')).toHaveCount(0);
    await expect(page.getByText('传统商业收费网站')).toHaveCount(0);
    await expect(page.getByText('通过率极高')).toHaveCount(0);
    await expect(page.getByText('绝对安全')).toHaveCount(0);
    await expect(page.getByText('100% 纯净')).toHaveCount(0);
  });

  test('每个区块最多一个主 CTA @s1', async ({ page }) => {
    await page.goto('/');

    // 首屏只有一个主按钮（另一个是锚点链接，不是 primary 按钮）
    const heroPrimary = page.locator('section').first().locator('button.bg-primary-600');
    await expect(heroPrimary).toHaveCount(1);

    // 页面底部不再有重复的转化横幅
    await expect(page.getByText('现在就让你的简历焕然一新')).toHaveCount(0);
  });

  test('模板卡片的 CTA 带上模板参数进入编辑器 @s1', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: '用这个模板开始（现代双栏型）' }).click();
    await page.waitForURL(/\/editor\/local_/);

    // 新建草稿后模板应生效
    await expect(page.locator('.modern-template')).toBeVisible();
  });

  test('FAQ 可展开收起且带 aria-expanded @s1', async ({ page }) => {
    await page.goto('/');

    const first = page.getByRole('button', { name: /导出的 PDF 文字能被招聘系统读取吗/ });
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('导出走浏览器原生打印')).toBeVisible();

    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByText('导出走浏览器原生打印')).toBeHidden();
  });
});
