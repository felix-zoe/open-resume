import { test, expect, collectPageErrors, type MockApiState } from './fixtures/mockApi';
import type { Page } from '@playwright/test';

/**
 * 触发批量上报。
 *
 * 生产里缓冲区最多等 10 秒或攒满 20 条才发；测试不该为此等 10 秒，
 * 直接派发 `pagehide` —— 这正是「用户关掉页面」时走的那条路径，
 * 顺带验证了 beacon 分支确实能发出数据。
 *
 * 为什么要循环：并行跑用例时 CPU 抢占会让 `main.ts` 的 `initTelemetry()`
 * 晚于首次派发，那一刻监听器还不存在，事件派发出去也没人接。
 * 反复派发直到真的收到数据，比「固定 sleep 500ms」稳定得多。
 */
async function flushTelemetry(
  page: Page,
  state: MockApiState,
  done: () => boolean = () => state.telemetry.length > 0
) {
  for (let attempt = 0; attempt < 50 && !done(); attempt += 1) {
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.waitForTimeout(100);
  }
}

/** 已经收到的错误事件条数 */
function errorCount(state: MockApiState): number {
  return state.telemetry.filter((event) => event.kind === 'error').length;
}

test.describe('可观测性 @s1', () => {
  test('页面浏览按路由名上报，路径里不含资源 id @s1', async ({ page, mockApi }) => {
    const record = mockApi.seed({ id: 'res_telemetry_probe', title: '埋点用简历' });
    await page.goto(`/editor/${record.id}`);
    await flushTelemetry(page, mockApi);

    expect(mockApi.telemetry.map((event) => event.name)).toContain('page.Editor');

    // 编辑器路径带着 res_xxx，上报里必须是归一化后的 /editor/:id
    const editorEvent = mockApi.telemetry.find((event) => event.name === 'page.Editor');
    expect(editorEvent?.path).toBe('/editor/:id');
    expect(JSON.stringify(mockApi.telemetry)).not.toContain(record.id);
  });

  test('未捕获异常被上报 @s0', async ({ page, mockApi }) => {
    await page.goto('/');
    await flushTelemetry(page, mockApi);

    // 在页面里制造一次未捕获异常
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error('保存失败');
      }, 0);
    });
    await page.waitForTimeout(100);

    const before = errorCount(mockApi);
    await flushTelemetry(page, mockApi, () => errorCount(mockApi) > before);

    expect(
      mockApi.telemetry.some((event) => event.kind === 'error' && event.name === 'window.error')
    ).toBe(true);
  });

  test('未处理的 Promise 拒绝也被捕获 @s0', async ({ page, mockApi }) => {
    await page.goto('/');
    await flushTelemetry(page, mockApi);

    await page.evaluate(() => {
      void Promise.reject(new Error('后台任务失败'));
    });
    await page.waitForTimeout(100);

    const before = errorCount(mockApi);
    await flushTelemetry(page, mockApi, () => errorCount(mockApi) > before);

    expect(
      mockApi.telemetry.some((event) => event.kind === 'error' && event.name === 'unhandledrejection')
    ).toBe(true);
  });

  test('导出上报格式，不上报文件名或简历标题 @s1', async ({ page, mockApi }) => {
    const record = mockApi.seed({ id: 'res_export_probe', title: '机密简历标题' });
    await page.goto(`/editor/${record.id}`);

    await page.getByRole('button', { name: '导出简历' }).click();
    await page.locator('#export-format').selectOption('json');
    await page.getByRole('button', { name: '下载文件' }).click();

    await flushTelemetry(page, mockApi);
    expect(mockApi.telemetry.map((event) => event.name)).toContain('export.json.ok');

    // 简历标题属于用户内容，任何埋点里都不该出现
    expect(JSON.stringify(mockApi.telemetry)).not.toContain('机密简历标题');
  });

  test('埋点请求不携带登录 token @s1', async ({ page, mockApi }) => {
    await page.addInitScript(() => {
      localStorage.setItem('open_resume_token', 'test-token');
      localStorage.setItem(
        'open_resume_user',
        JSON.stringify({ id: 'usr_test', email: 'test@example.com', nickname: '测试用户' })
      );
    });
    await page.goto('/dashboard');
    await flushTelemetry(page, mockApi);

    const telemetryRequests = mockApi.requests.filter((request) => request.path === '/api/telemetry');
    expect(telemetryRequests.length).toBeGreaterThan(0);
    for (const request of telemetryRequests) {
      expect(request.authorization).toBeNull();
    }
  });

  test('埋点上报失败不影响页面可用 @s0', async ({ page }) => {
    const errors = collectPageErrors(page);
    // 让上报接口直接 500
    await page.route('**/api/telemetry', (route) => route.fulfill({ status: 500, body: '' }));

    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // 上报失败被吞掉：页面上不应该出现任何相关提示
    await expect(page.getByText(/埋点|上报失败/)).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
