import { defineConfig, devices } from '@playwright/test';

// 默认复用系统 Chrome，避免在 Windows 上额外下载 Chromium。
// 如需使用 Playwright 自带浏览器：PW_CHANNEL=bundled
// 如需使用 Edge：PW_CHANNEL=msedge
const channel = process.env.PW_CHANNEL ?? 'chrome';
const useChannel = channel !== 'bundled';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(useChannel ? { channel: channel as 'chrome' | 'msedge' } : {})
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Windows 上 localhost 可能解析到 ::1，显式绑定 127.0.0.1 与 baseURL 保持一致
    command: 'npm run preview -- --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
});
