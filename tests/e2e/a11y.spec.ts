import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures/mockApi';
import type { Page } from '@playwright/test';

/**
 * 可访问性门禁：只拦 serious / critical。
 * moderate 及以下（如色对比度临界值）先记录，不阻塞 Sprint 1。
 */
async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
}

function blockingViolations(results: Awaited<ReturnType<typeof scan>>) {
  return results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical'
  );
}

function describeViolations(violations: ReturnType<typeof blockingViolations>) {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact}): ${violation.help}\n  ${violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(' '))
          .join('\n  ')}`
    )
    .join('\n');
}

async function login(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('open_resume_token', 'test-token');
    localStorage.setItem(
      'open_resume_user',
      JSON.stringify({ id: 'usr_test', email: 'test@example.com', nickname: '测试用户' })
    );
  });
}

test.describe('可访问性 @s1', () => {
  test('首页无 serious/critical 问题 @s1', async ({ page }) => {
    await page.goto('/');
    await page.locator('main h1').first().waitFor();
    const violations = blockingViolations(await scan(page));
    expect(violations, describeViolations(violations)).toHaveLength(0);
  });

  test('登录页无 serious/critical 问题 @s1', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('heading', { name: '登录您的账户' }).waitFor();
    const violations = blockingViolations(await scan(page));
    expect(violations, describeViolations(violations)).toHaveLength(0);
  });

  test('看板无 serious/critical 问题 @s1', async ({ page, mockApi }) => {
    await login(page);
    mockApi.seed({ id: 'res_a11y', title: '可访问性测试简历' });
    await page.goto('/dashboard');
    await page.getByText('可访问性测试简历').waitFor();
    const violations = blockingViolations(await scan(page));
    expect(violations, describeViolations(violations)).toHaveLength(0);
  });

  test('编辑器无 serious/critical 问题 @s1', async ({ page }) => {
    await page.goto('/editor/demo');
    await page.locator('.a4-print-target').waitFor();
    const violations = blockingViolations(await scan(page));
    expect(violations, describeViolations(violations)).toHaveLength(0);
  });

  test('分享页无 serious/critical 问题 @s1', async ({ page, mockApi }) => {
    mockApi.seed({ id: 'demo', title: '分享页简历', isPublic: 1 });
    await page.goto('/share/demo');
    await page.locator('.a4-print-target').waitFor();
    const violations = blockingViolations(await scan(page));
    expect(violations, describeViolations(violations)).toHaveLength(0);
  });
});
