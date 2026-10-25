import { test, expect, collectPageErrors } from './fixtures/mockApi';

/**
 * PWA 验证的是**构建产物**，不是源码。
 * `vite preview` 会原样托管 `dist/`，所以 manifest、sw.js、预渲染 HTML 都能直接取到。
 */

test.describe('PWA 与离线 @s1', () => {
  test('manifest 可访问且字段完整 @s1', async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/manifest.webmanifest`);
    expect(response.status()).toBe(200);

    const manifest = await response.json();
    expect(manifest.name).toContain('OpenResume');
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#2563eb');

    // 192 与 512 是 Chrome 安装判定的最低要求
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    // maskable：系统裁圆形时不能露白边
    expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === 'maskable')).toBe(true);
  });

  test('图标资源可访问且为 PNG @s1', async ({ page, baseURL }) => {
    for (const path of ['/pwa-192x192.png', '/pwa-512x512.png', '/apple-touch-icon.png']) {
      const response = await page.request.get(`${baseURL}${path}`);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['content-type'], path).toContain('image/png');
    }
  });

  test('Service Worker 可访问，且预缓存包含应用壳 @s1', async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/sw.js`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/javascript/);

    const sw = await response.text();
    // 预缓存清单里必须有入口 HTML 与预渲染的示例页，否则离线打开是白屏
    expect(sw).toContain('index.html');
    expect(sw).toContain('examples/frontend');
    // API 绝不进缓存：换账号后不能读到上一个人的简历
    expect(sw).not.toContain('"/api/resumes');
  });

  test('页面注入 manifest 链接与 iOS 图标 @s1', async ({ page, baseURL }) => {
    const response = await page.request.get(`${baseURL}/`);
    const html = await response.text();

    expect(html).toContain('rel="manifest"');
    expect(html).toContain('apple-touch-icon');
  });

  test('生产构建注册 Service Worker 并进入 controlled 状态 @s1', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto('/');

    // 等 SW 注册完成；`navigator.serviceWorker.ready` 在没有 SW 的构建里会一直挂起，
    // 用带超时的轮询避免拖垮整条用例
    const registered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 8000));
      const ready = navigator.serviceWorker.ready.then(() => true as const);
      return Promise.race([ready, timeout]);
    });

    expect(registered).toBe(true);
    expect(errors).toEqual([]);
  });

  /**
   * 等 SW 装好并**接管当前页**。
   *
   * `clientsClaim: false`（有意为之：避免 SW 在用户毫无准备时接管页面），
   * 所以首次访问的页面不受控，需要再导航一次。这也正是真实用户的体验：
   * 第一次打开完成预缓存，之后的导航才走缓存。
   */
  async function waitForControl(page: import('@playwright/test').Page) {
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return;
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
      timeout: 15_000
    });
  }

  test('离线时仍能打开应用壳 @s1', async ({ page, context }) => {
    await page.goto('/');
    await page.locator('main h1').first().waitFor();

    await waitForControl(page);
    // 第二次导航起由 SW 接管
    await page.reload();
    await expect(page.locator('main h1').first()).toBeVisible();

    await context.setOffline(true);
    try {
      await page.reload();
      // 应用壳来自 SW 缓存：标题与主内容仍在
      await expect(page.locator('body')).toContainText('OpenResume');
      await expect(page.locator('main h1').first()).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test('预渲染页也在缓存里：离线打开示例页有正确标题 @s1', async ({ page, context }) => {
    // 先在线访问一次，让 SW 装好并完成预缓存
    await page.goto('/examples/frontend');
    await waitForControl(page);
    await page.goto('/examples/frontend');

    await context.setOffline(true);
    try {
      await page.goto('/examples/frontend');
      // 标题来自预渲染的 head，说明缓存里存的是那份带正确 meta 的 HTML
      await expect(page).toHaveTitle(/前端工程师简历模板与写法示例/);
    } finally {
      await context.setOffline(false);
    }
  });
});
