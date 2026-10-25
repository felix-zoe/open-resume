import { test, expect, collectPageErrors } from './fixtures/mockApi';

test.describe('简历示例页 @s1', () => {
  test('示例库列出全部岗位，且可进入详情 @s1', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto('/examples');

    await expect(page.getByRole('heading', { level: 1, name: '按岗位挑选起点' })).toBeVisible();
    await expect(page.locator('main').getByRole('link', { name: '前端工程师简历' })).toBeVisible();
    await expect(page.locator('main').getByRole('link', { name: '外企英文简历' })).toBeVisible();

    await page.locator('main').getByRole('link', { name: '产品经理简历' }).click();
    await page.waitForURL('**/examples/product');
    await expect(page.getByRole('heading', { level: 1, name: '产品经理简历模板与写法示例' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('详情页展示真实模板渲染，而不是截图 @s1', async ({ page }) => {
    await page.goto('/examples/frontend');

    // 极客模板真实挂载
    await expect(page.locator('.template-preview .geek-template')).toHaveCount(1);
    // 预览是装饰，对读屏隐藏且不可聚焦
    await expect(page.locator('.template-preview')).toHaveAttribute('aria-hidden', 'true');
  });

  test('英文示例使用 ATS 模板，且不出现中文默认范文 @s1', async ({ page }) => {
    await page.goto('/examples/foreign-company');

    await expect(page.locator('.template-preview .ats-template')).toHaveCount(1);
    await expect(page.getByText('English', { exact: true })).toBeVisible();
  });

  test('「用这个模板开始」进入编辑器后模板与语言都已生效 @s1', async ({ page }) => {
    await page.goto('/examples/foreign-company');

    // 进入编辑器后 URL 会被 replace 成本地草稿 id（query 随之丢弃），
    // 所以断言的是「新建出来的草稿」而不是 query 参数
    await page.getByRole('button', { name: '用这个模板开始' }).click();
    await page.waitForURL(/\/editor\/local_/);

    await expect(page.locator('.ats-template')).toBeVisible();
    // 英文示例必须带出英文范文，否则用户看到的是中文占位内容
    await expect(page.locator('.resume-doc')).toContainText('Work Experience');
    await expect(page.locator('.resume-doc')).not.toContainText('工作经历');
  });

  test('未知 slug 落到 404，而不是静默显示列表 @s1', async ({ page }) => {
    await page.goto('/examples/not-a-real-role');
    await expect(page.getByText('这个页面不存在')).toBeVisible();
  });

  test('详情页写入 canonical 与面包屑结构化数据 @s1', async ({ page }) => {
    await page.goto('/examples/backend');
    await expect(page).toHaveTitle(/后端工程师简历模板与写法示例/);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toMatch(/\/examples\/backend$/);

    const jsonLd = await page.locator('script[data-seo="breadcrumb"]').textContent();
    expect(jsonLd).toContain('BreadcrumbList');
    expect(jsonLd).toContain('后端工程师简历');
  });
});

test.describe('SEO 静态资源 @s0', () => {
  test('robots.txt 可访问且指向 sitemap @s0', async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/robots.txt`);
    expect(response.status()).toBe(200);

    const text = await response.text();
    expect(text).toContain('Sitemap:');
    // 私有页面不该被索引
    expect(text).toContain('Disallow: /editor/');
    expect(text).toContain('Disallow: /s/');
  });

  test('sitemap.xml 是合法 XML 且包含示例页 @s0', async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/sitemap.xml`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/xml/);

    const text = await response.text();
    expect(text).toContain('<urlset');
    expect(text).toContain('/examples/frontend');
    // 私密与需登录的页面不该出现在 sitemap
    expect(text).not.toContain('/editor/');
    expect(text).not.toContain('/share/');
  });

  test('示例页的 head 在服务端就已正确（不依赖 JS）@s0', async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/examples/frontend`);
    const html = await response.text();

    expect(html).toContain('<title>前端工程师简历模板与写法示例 · OpenResume</title>');
    expect(html).toContain('property="og:title"');
    expect(html).toContain('BreadcrumbList');
    // 只保留一份标题，避免爬虫取到站点默认标题
    expect(html.match(/<title>/g)).toHaveLength(1);
  });
});
