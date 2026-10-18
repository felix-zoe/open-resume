import { test, expect, collectPageErrors } from './fixtures/mockApi';
import type { MockApiState } from './fixtures/mockApi';

/** 公开简历中注入恶意外链，验证分享页不会渲染成可点击锚点 */
function seedMaliciousResume(state: MockApiState) {
  return state.seed({
    id: 'res_xss',
    isPublic: 1,
    content: {
      profile: {
        name: '恶意链接测试',
        title: '前端工程师',
        email: 'xss@example.com',
        phone: '138 0000 0000',
        showAvatar: false,
        github: 'javascript:alert("github")',
        website: 'javascript:alert("website")'
      },
      modulesOrder: ['projects', 'work', 'skills', 'education', 'custom'],
      modules: {
        work: { visible: false, title: '工作经历', items: [] },
        projects: {
          visible: true,
          title: '项目经历',
          items: [
            {
              id: 'proj-xss',
              name: '恶意项目',
              role: '作者',
              startDate: '2024.01',
              endDate: '2024.06',
              link: 'javascript:alert("project")',
              description: '项目描述'
            }
          ]
        },
        skills: { visible: false, title: '专业技能', items: [] },
        education: { visible: false, title: '教育背景', items: [] },
        custom: { visible: false, title: '自定义模块', items: [] }
      }
    }
  });
}

test.describe('share page @s0', () => {
  test('xss: javascript: 外链不会渲染为锚点且不弹窗 @s0', async ({ page, mockApi }) => {
    seedMaliciousResume(mockApi);

    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    const errors = collectPageErrors(page);
    await page.goto('/share/res_xss');

    // 简历正文渲染成功
    await expect(page.getByText('恶意链接测试')).toBeVisible();

    // 三个恶意链接都不得生成 href
    const unsafeAnchors = await page.locator('a[href^="javascript:"]').count();
    expect(unsafeAnchors).toBe(0);

    // 非法链接整体不渲染（不是 href="#" 占位）
    await expect(page.getByRole('link', { name: 'GitHub' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '作品集' })).toHaveCount(0);
    await expect(page.getByText('演示链接')).toHaveCount(0);

    // 页面上所有锚点都不允许 javascript: 协议
    const hrefs = await page.locator('a').evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLAnchorElement).getAttribute('href') ?? '')
    );
    expect(hrefs.some((href) => href.toLowerCase().startsWith('javascript:'))).toBe(false);

    expect(dialogs).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('合法外链正常渲染并可点击 @s0', async ({ page, mockApi }) => {
    mockApi.seed({
      id: 'res_ok',
      isPublic: 1,
      content: {
        profile: {
          name: '正常链接测试',
          title: '前端工程师',
          email: 'ok@example.com',
          phone: '138 0000 0001',
          showAvatar: false,
          github: 'https://github.com/example',
          website: 'blog.example.com'
        },
        modulesOrder: ['projects', 'work', 'skills', 'education', 'custom'],
        modules: {
          work: { visible: false, title: '工作经历', items: [] },
          projects: { visible: true, title: '项目经历', items: [] },
          skills: { visible: false, title: '专业技能', items: [] },
          education: { visible: false, title: '教育背景', items: [] },
          custom: { visible: false, title: '自定义模块', items: [] }
        }
      }
    });

    await page.goto('/share/res_ok');
    await expect(page.getByText('正常链接测试')).toBeVisible();

    const github = page.getByRole('link', { name: 'GitHub' });
    await expect(github).toHaveAttribute('href', 'https://github.com/example');
    await expect(github).toHaveAttribute('rel', 'noopener noreferrer');

    // 裸域名被补全为 https
    await expect(page.getByRole('link', { name: '作品集' })).toHaveAttribute(
      'href',
      'https://blog.example.com/'
    );
  });

  test('游客分享被拦截：不复制链接、不产生 /share/local_ 地址 @s0', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__clipboardWrites = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (text: string) => {
            (window as any).__clipboardWrites.push(text);
            return Promise.resolve();
          }
        }
      });
    });

    await page.goto('/editor/new');
    await page.waitForURL(/\/editor\/local_/);

    await page.getByRole('button', { name: '分享' }).click();

    await expect(page.getByText(/分享前需要先登录并保存到云端/)).toBeVisible();

    const writes = await page.evaluate(() => (window as any).__clipboardWrites as string[]);
    expect(writes).toEqual([]);
  });

  test('demo 简历同样不生成分享链接 @s0', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__clipboardWrites = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (text: string) => {
            (window as any).__clipboardWrites.push(text);
            return Promise.resolve();
          }
        }
      });
    });

    await page.goto('/editor/demo');
    await expect(page.locator('.resume-doc')).toBeVisible();

    await page.getByRole('button', { name: '分享' }).click();
    await expect(page.getByText(/分享前需要先登录并保存到云端/)).toBeVisible();

    const writes = await page.evaluate(() => (window as any).__clipboardWrites as string[]);
    expect(writes).toEqual([]);
  });

  test('未公开的简历展示权限提示 @s0', async ({ page, mockApi }) => {
    mockApi.seed({ id: 'res_private', isPublic: 0 });
    await page.goto('/share/res_private');
    await expect(page.getByText('该简历暂未开启公开分享，请联系求职者开启后查阅')).toBeVisible();
  });
});
