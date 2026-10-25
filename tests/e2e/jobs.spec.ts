import { test, expect } from './fixtures/mockApi';
import type { Page } from '@playwright/test';

async function login(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('open_resume_token', 'test-token');
    localStorage.setItem(
      'open_resume_user',
      JSON.stringify({ id: 'usr_test', email: 'test@example.com', nickname: '测试用户' })
    );
  });
}

const NOW = () => Math.floor(Date.now() / 1000);

/** 读取汇总卡片的值：用 dt 文本定位最近的卡片，避免多个「50%」互相干扰 */
function statValue(page: Page, label: string) {
  return page
    .locator('div', { has: page.getByText(label, { exact: true }) })
    .last()
    .locator('dd');
}

test.describe('投递管理 @s1', () => {
  test('空态引导，添加后可看板展示 @s1', async ({ page, mockApi }) => {
    await login(page);
    await page.goto('/jobs');

    await expect(page.getByRole('heading', { name: '投递管理' })).toBeVisible();
    await expect(page.getByText('还没有投递记录')).toBeVisible();

    await page.getByRole('button', { name: '添加第一条记录' }).click();
    const dialog = page.getByRole('dialog', { name: '添加投递记录' });
    await expect(dialog).toBeVisible();

    // 用 placeholder 定位：必填字段的可访问名带「必填」后缀，按 label 精确匹配会很脆
    await dialog.getByPlaceholder('如：某互联网公司').fill('某互联网公司');
    await dialog.getByPlaceholder('如：高级前端工程师').fill('高级前端工程师');
    await dialog.getByPlaceholder('如：北京').fill('北京');
    await dialog.getByRole('button', { name: '添加记录' }).click();

    await expect(page.getByText('某互联网公司')).toBeVisible();
    const created = mockApi.find('POST', '/api/jobs')[0];
    expect(created.body).toMatchObject({
      company: '某互联网公司',
      position: '高级前端工程师',
      location: '北京',
      status: 'applied'
    });
    // 「已投递」且没填日期时，服务端补上今天，时间线才有起点
    const stored = Array.from(mockApi.jobs.values())[0];
    expect(stored.appliedAt).toBeGreaterThan(0);
  });

  test('公司/岗位必填，缺失时不发请求 @s1', async ({ page, mockApi }) => {
    await login(page);
    await page.goto('/jobs');
    await page.getByRole('button', { name: '添加第一条记录' }).click();

    const dialog = page.getByRole('dialog', { name: '添加投递记录' });
    await dialog.getByRole('button', { name: '添加记录' }).click();

    await expect(dialog.getByText('请填写公司名称')).toBeVisible();
    await expect(dialog.getByText('请填写岗位名称')).toBeVisible();
    expect(mockApi.count('POST', '/api/jobs')).toBe(0);
  });

  test('看板可移动状态，统计随之后更新 @s1', async ({ page, mockApi }) => {
    await login(page);
    mockApi.seedJob({ id: 'job_a', company: '甲公司', position: '前端', status: 'applied' });
    mockApi.seedJob({ id: 'job_b', company: '乙公司', position: '后端', status: 'interviewing' });

    await page.goto('/jobs');
    await expect(page.getByText('甲公司')).toBeVisible();

    // 面试率 = (面试中 1 + offer 0) / 已投递 2 = 50%
    await expect(statValue(page, '面试率')).toHaveText('50%');
    await expect(statValue(page, 'Offer 率')).toHaveText('0%');

    const card = page.locator('li', { hasText: '甲公司' }).first();
    await card.getByRole('button', { name: '更多操作' }).click();
    await page.getByRole('menuitem', { name: '移到已录用' }).click();

    await expect.poll(() => mockApi.find('PATCH', '/api/jobs/job_a').length).toBe(1);
    expect(mockApi.find('PATCH', '/api/jobs/job_a')[0].body).toMatchObject({ status: 'offer' });
    // Offer 率变成 50%（1 / 2）
    await expect(statValue(page, 'Offer 率')).toHaveText('50%');
  });

  test('跟进提醒只提示未结束且 7 天内到期的记录 @s1', async ({ page, mockApi }) => {
    await login(page);
    mockApi.seedJob({
      id: 'job_due',
      company: '近期待跟进',
      position: '前端',
      status: 'applied',
      nextActionAt: NOW() + 2 * 86400,
      nextActionNote: '等一面结果'
    });
    mockApi.seedJob({
      id: 'job_far',
      company: '远期跟进',
      position: '后端',
      status: 'applied',
      nextActionAt: NOW() + 30 * 86400
    });
    mockApi.seedJob({
      id: 'job_done',
      company: '已录用不再提醒',
      position: '全栈',
      status: 'offer',
      nextActionAt: NOW() + 86400
    });

    await page.goto('/jobs');
    await expect(page.getByText('近期需要跟进')).toBeVisible();
    const reminder = page.locator('div.bg-white', { hasText: '近期需要跟进' }).first();
    await expect(reminder.getByText('近期待跟进')).toBeVisible();
    await expect(reminder.getByText('等一面结果')).toBeVisible();
    await expect(reminder.getByText('远期跟进')).toHaveCount(0);
    await expect(reminder.getByText('已录用不再提醒')).toHaveCount(0);
  });

  test('可切换到列表视图，偏好本地记住 @s1', async ({ page, mockApi }) => {
    await login(page);
    mockApi.seedJob({ id: 'job_1', company: '甲公司', position: '前端' });

    await page.goto('/jobs');
    await expect(page.getByRole('button', { name: '看板视图' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: '列表视图' }).click();
    await expect(page.getByRole('button', { name: '列表视图' })).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.getByRole('button', { name: '列表视图' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('删除需确认，取消不删 @s1', async ({ page, mockApi }) => {
    await login(page);
    mockApi.seedJob({ id: 'job_del', company: '待删公司', position: '前端' });

    await page.goto('/jobs');
    await page.getByRole('button', { name: '列表视图' }).click();

    const row = page.locator('li', { hasText: '待删公司' }).first();
    await row.getByRole('button', { name: '删除' }).click();

    const dialog = page.getByRole('dialog', { name: '删除这条投递记录？' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: '取消' }).click();
    expect(mockApi.count('DELETE', '/api/jobs/job_del')).toBe(0);

    await row.getByRole('button', { name: '删除' }).click();
    await page.getByRole('dialog', { name: '删除这条投递记录？' }).getByRole('button', { name: '删除' }).click();
    await expect.poll(() => mockApi.count('DELETE', '/api/jobs/job_del')).toBe(1);
    await expect(page.getByText('待删公司')).toHaveCount(0);
  });

  test('未登录访问投递页被重定向到登录页 @s1', async ({ page }) => {
    await page.goto('/jobs');
    await page.waitForURL(/\/login/);
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/jobs');
  });
});
