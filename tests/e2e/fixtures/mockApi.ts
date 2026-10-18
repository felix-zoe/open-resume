import { test as base, expect, type Page, type Route } from '@playwright/test';

/**
 * 内存版 API mock。
 *
 * 设计目标：
 * - 每个用例独立的确定性状态，可断言“发了几次请求、请求体是什么”；
 * - 可模拟 401 / 慢网络 / 私有简历等真实后端难以稳定构造的场景；
 * - 不启动 wrangler / D1，保证 Windows 上 E2E 稳定且快速。
 *
 * 盲区：无法覆盖 D1 schema、真实 JWT、R2 行为。这些由后端纯函数单测补偿。
 */

export interface MockResumeRecord {
  id: string;
  userId: string;
  title: string;
  templateId: string;
  content: unknown;
  themeConfig: unknown;
  isPublic: number;
  createdAt: number;
  updatedAt: number;
}

export interface MockRequestRecord {
  method: string;
  path: string;
  body: unknown;
  authorization: string | null;
}

export const DEMO_CONTENT = {
  profile: {
    name: '张小凡',
    title: '资深前端研发工程师',
    email: 'xiaofan.zhang@example.com',
    phone: '138 0013 8000',
    location: '北京 · 海淀',
    workYears: '5年经验',
    showAvatar: false,
    summary: '5 年前端研发经验。'
  },
  modulesOrder: ['work', 'projects', 'skills', 'education', 'custom'],
  modules: {
    work: {
      visible: true,
      title: '工作经历',
      items: [
        {
          id: 'work-1',
          company: '某互联网公司',
          position: '前端工程师',
          startDate: '2022.07',
          endDate: '至今',
          description: '• 负责核心业务开发'
        }
      ]
    },
    projects: { visible: true, title: '项目经历', items: [] },
    skills: { visible: true, title: '专业技能', items: ['Vue3 / TypeScript'] },
    education: {
      visible: true,
      title: '教育背景',
      items: [
        {
          id: 'edu-1',
          school: '北京航空航天大学',
          major: '软件工程',
          degree: '本科',
          startDate: '2014.09',
          endDate: '2018.06'
        }
      ]
    },
    custom: { visible: false, title: '自定义模块', items: [] }
  }
};

export const DEMO_THEME = {
  themeColor: '#2563EB',
  fontFamily: 'font-sans',
  fontSize: 14,
  lineHeight: 1.5,
  paragraphSpacing: 6,
  sectionSpacing: 16,
  pagePadding: 18,
  showBorder: true
};

export class MockApiState {
  token = 'test-token';
  user = { id: 'usr_test', email: 'test@example.com', nickname: '测试用户' };
  resumes = new Map<string, MockResumeRecord>();
  requests: MockRequestRecord[] = [];
  /** 所有受保护接口返回 401（用于验证全局登出逻辑） */
  unauthorized = false;
  /** 给每个响应附加延迟（毫秒），用于复现竞态 */
  delayMs = 0;
  /** /api/share/:id 的返回状态：200 正常，403 未公开，404 不存在 */
  shareStatus: 200 | 403 | 404 = 200;
  private seq = 0;

  nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}_${this.seq}`;
  }

  seed(partial: Partial<MockResumeRecord> = {}): MockResumeRecord {
    const id = partial.id ?? this.nextId('res');
    const now = Math.floor(Date.now() / 1000);
    const record: MockResumeRecord = {
      id,
      userId: this.user.id,
      title: '未命名求职简历',
      templateId: 'classic',
      content: JSON.parse(JSON.stringify(DEMO_CONTENT)),
      themeConfig: JSON.parse(JSON.stringify(DEMO_THEME)),
      isPublic: 0,
      createdAt: now,
      updatedAt: now,
      ...partial
    };
    this.resumes.set(id, record);
    return record;
  }

  find(method: string, pathPrefix: string): MockRequestRecord[] {
    return this.requests.filter(
      (r) => r.method.toUpperCase() === method.toUpperCase() && r.path.startsWith(pathPrefix)
    );
  }

  count(method: string, pathPrefix: string): number {
    return this.find(method, pathPrefix).length;
  }

  reset() {
    this.resumes.clear();
    this.requests = [];
    this.unauthorized = false;
    this.delayMs = 0;
    this.shareStatus = 200;
  }
}

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({
    status,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(body)
  });

const ok = (route: Route, data: unknown, message = 'success') =>
  json(route, 200, { code: 0, message, data });

const fail = (route: Route, status: number, code: number, message: string) =>
  json(route, status, { code, message, data: null });

function isAuthorized(state: MockApiState, authorization: string | null): boolean {
  if (!authorization) return false;
  return authorization === `Bearer ${state.token}`;
}

async function handleApi(route: Route, state: MockApiState): Promise<void> {
  const request = route.request();
  const method = request.method().toUpperCase();
  const url = new URL(request.url());
  const path = url.pathname;

  let body: unknown = null;
  try {
    body = request.postDataJSON();
  } catch {
    body = null;
  }

  state.requests.push({
    method,
    path,
    body,
    authorization: request.headers()['authorization'] ?? null
  });

  if (state.delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, state.delayMs));
  }

  // ---- 认证 ----
  if (method === 'POST' && (path === '/api/auth/login' || path === '/api/auth/register')) {
    if (state.unauthorized) {
      return fail(route, 401, 40103, '账号或密码错误');
    }
    return ok(route, { token: state.token, user: state.user }, '成功');
  }

  if (method === 'GET' && path === '/api/auth/me') {
    if (!isAuthorized(state, request.headers()['authorization'] ?? null)) {
      return fail(route, 401, 40101, '未授权');
    }
    return ok(route, state.user);
  }

  // ---- 公开分享（无需鉴权）----
  if (method === 'GET' && path.startsWith('/api/share/')) {
    if (state.shareStatus === 404) return fail(route, 404, 40401, '简历不存在');
    if (state.shareStatus === 403) return fail(route, 403, 40301, '该简历暂未开启公开分享');
    const id = path.replace('/api/share/', '');
    const record = state.resumes.get(id);
    if (!record) return fail(route, 404, 40401, '简历不存在');
    if (record.isPublic !== 1) return fail(route, 403, 40301, '该简历暂未开启公开分享');
    return ok(route, {
      id: record.id,
      title: record.title,
      templateId: record.templateId,
      content: record.content,
      themeConfig: record.themeConfig,
      isPublic: record.isPublic,
      updatedAt: record.updatedAt
    });
  }

  if (method === 'POST' && /^\/api\/share\/[^/]+\/visit$/.test(path)) {
    return ok(route, { visitId: 'v_test' });
  }

  // ---- 受保护接口 ----
  const authorization = request.headers()['authorization'] ?? null;
  if (state.unauthorized || !isAuthorized(state, authorization)) {
    return fail(route, 401, 40101, '请先登录');
  }

  if (method === 'GET' && path === '/api/resumes') {
    const list = Array.from(state.resumes.values())
      .filter((r) => r.userId === state.user.id)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((r) => ({
        id: r.id,
        title: r.title,
        templateId: r.templateId,
        isPublic: r.isPublic,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      }));
    return ok(route, list);
  }

  if (method === 'POST' && path === '/api/resumes') {
    const payload = (body ?? {}) as Partial<MockResumeRecord>;
    const record = state.seed({
      title: payload.title ?? '未命名求职简历',
      templateId: payload.templateId ?? 'classic',
      content: payload.content ?? DEMO_CONTENT,
      themeConfig: payload.themeConfig ?? DEMO_THEME
    });
    return ok(route, { id: record.id, title: record.title, templateId: record.templateId }, '创建成功');
  }

  if (method === 'GET' && path === '/api/analytics/overview') {
    const list = Array.from(state.resumes.values()).map((r) => ({
      resumeId: r.id,
      totalViews: 0,
      avgDuration: 0,
      totalDownloads: 0
    }));
    return ok(route, list);
  }

  const resumeMatch = path.match(/^\/api\/resumes\/([^/]+)$/);
  if (resumeMatch) {
    const id = resumeMatch[1];
    const record = state.resumes.get(id);

    if (method === 'GET') {
      if (!record) return fail(route, 404, 40401, '简历不存在');
      return ok(route, {
        id: record.id,
        title: record.title,
        templateId: record.templateId,
        content: record.content,
        themeConfig: record.themeConfig,
        isPublic: record.isPublic,
        updatedAt: record.updatedAt
      });
    }

    if (method === 'PUT') {
      if (!record) return fail(route, 404, 40401, '简历不存在');
      const payload = (body ?? {}) as Partial<MockResumeRecord>;
      record.title = payload.title ?? record.title;
      record.templateId = payload.templateId ?? record.templateId;
      record.content = payload.content ?? record.content;
      record.themeConfig = payload.themeConfig ?? record.themeConfig;
      record.updatedAt = Math.floor(Date.now() / 1000);
      return ok(route, { id: record.id, updatedAt: record.updatedAt }, '保存成功');
    }

    if (method === 'PATCH') {
      if (!record) return fail(route, 404, 40401, '简历不存在');
      const payload = (body ?? {}) as Partial<MockResumeRecord>;
      const title = typeof payload.title === 'string' ? payload.title.trim() : '';
      if (title.length < 1 || title.length > 100) {
        return fail(route, 400, 40001, '标题需为 1-100 个字符');
      }
      record.title = title;
      record.updatedAt = Math.floor(Date.now() / 1000);
      return ok(route, { id: record.id, title: record.title, updatedAt: record.updatedAt }, '更新成功');
    }

    if (method === 'DELETE') {
      if (!record) return fail(route, 404, 40401, '简历不存在');
      state.resumes.delete(id);
      return ok(route, { id }, '删除成功');
    }
  }

  const shareMatch = path.match(/^\/api\/resumes\/([^/]+)\/share$/);
  if (method === 'POST' && shareMatch) {
    const record = state.resumes.get(shareMatch[1]);
    if (!record) return fail(route, 404, 40401, '简历不存在');
    const payload = (body ?? {}) as { isPublic?: number | boolean };
    record.isPublic = payload.isPublic ? 1 : 0;
    return ok(route, { id: record.id, isPublic: record.isPublic });
  }

  const analyticsMatch = path.match(/^\/api\/resumes\/([^/]+)\/analytics$/);
  if (method === 'GET' && analyticsMatch) {
    return ok(route, {
      totalViews: 0,
      avgDuration: 0,
      totalDownloads: 0,
      recentVisits: []
    });
  }

  if (method === 'POST' && path === '/api/upload/avatar') {
    return ok(route, { url: '/api/file/open-resume/avatars/usr_test/test.webp' });
  }

  return fail(route, 404, 40400, `未 mock 的接口: ${method} ${path}`);
}

export const test = base.extend<{ mockApi: MockApiState }>({
  mockApi: async ({ page }, use) => {
    const state = new MockApiState();
    await page.route('**/api/**', (route) => handleApi(route, state));
    await use(state);
  }
});

export { expect };

/** 便于在测试里读取页面错误 */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}
