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
  /** 列表接口顺带返回的完整度；不传时 mock 统一给满分 */
  completeness?: { score: number; missing: string[] };
}

export interface MockRequestRecord {
  method: string;
  path: string;
  body: unknown;
  authorization: string | null;
}

export interface MockJobApplication {
  id: string;
  userId: string;
  resumeId: string | null;
  company: string;
  position: string;
  location: string | null;
  channel: string | null;
  status: 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected';
  appliedAt: number | null;
  nextActionAt: number | null;
  nextActionNote: string | null;
  salaryRange: string | null;
  jobUrl: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MockShareLink {
  id: string;
  resumeId: string;
  token: string;
  label: string;
  expiresAt: number | null;
  allowDownload: boolean;
  maskContact: boolean;
  hasPassword: boolean;
  password?: string;
  revokedAt: number | null;
  viewCount: number;
  lastViewedAt: number | null;
  createdAt: number;
  status: 'ok' | 'revoked' | 'expired' | 'needs-password';
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
  /** 当前密码；改密成功后更新，用于验证「旧密码失效」 */
  password = 'secret123';
  /** 注销申请时间（秒）；null 表示未申请 */
  deletionRequestedAt: number | null = null;
  resumes = new Map<string, MockResumeRecord>();
  requests: MockRequestRecord[] = [];
  /** 所有受保护接口返回 401（用于验证全局登出逻辑） */
  unauthorized = false;
  /** 给每个响应附加延迟（毫秒），用于复现竞态 */
  delayMs = 0;
  /** /api/share/:id 的返回状态：200 正常，403 未公开，404 不存在 */
  shareStatus: 200 | 403 | 404 = 200;
  /** token 化分享链接，按 token 索引 */
  shareLinks = new Map<string, MockShareLink>();
  /** 投递记录 */
  jobs = new Map<string, MockJobApplication>();
  /** 收到的埋点批次（只保留事件名，便于断言「上报了什么」而不必关心时间戳） */
  telemetry: Array<{ kind: string; name: string; path?: string }> = [];
  /**
   * AI 改写的固定返回。设了就用它，没设就按「每行加前缀」派生一份 ——
   * 用例需要断言「采纳后正文变成了什么」时，必须有一个确定的期望值。
   */
  aiRewriteResult: string | null = null;
  /** 让 /api/ai/rewrite 返回失败，用于验证错误提示与「不写入」 */
  aiError: { status: number; code: number; message: string } | null = null;
  /** /api/ai/models 返回的模型清单 */
  aiModels: string[] = ['deepseek-chat', 'deepseek-reasoner'];
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

  seedShareLink(resumeId: string, partial: Partial<MockShareLink> = {}): MockShareLink {
    const now = Math.floor(Date.now() / 1000);
    const link: MockShareLink = {
      id: this.nextId('sl'),
      resumeId,
      token: partial.token ?? `tok${this.seq}abc`,
      label: '',
      expiresAt: now + 30 * 24 * 3600,
      allowDownload: true,
      maskContact: true,
      hasPassword: false,
      revokedAt: null,
      viewCount: 0,
      lastViewedAt: null,
      createdAt: now,
      status: 'ok',
      ...partial
    };
    this.shareLinks.set(link.token, link);
    return link;
  }

  seedJob(partial: Partial<MockJobApplication> = {}): MockJobApplication {
    const id = partial.id ?? this.nextId('job');
    const now = Math.floor(Date.now() / 1000);
    const record: MockJobApplication = {
      id,
      userId: this.user.id,
      resumeId: null,
      company: '某公司',
      position: '前端工程师',
      location: null,
      channel: null,
      status: 'applied',
      appliedAt: now,
      nextActionAt: null,
      nextActionNote: null,
      salaryRange: null,
      jobUrl: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
      ...partial
    };
    this.jobs.set(id, record);
    return record;
  }

  reset() {
    this.telemetry = [];
    this.resumes.clear();
    this.requests = [];
    this.unauthorized = false;
    this.delayMs = 0;
    this.shareStatus = 200;
    this.shareLinks.clear();
    this.jobs.clear();
    this.password = 'secret123';
    this.deletionRequestedAt = null;
    this.aiRewriteResult = null;
    this.aiError = null;
    this.aiModels = ['deepseek-chat', 'deepseek-reasoner'];
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

/** 与服务端 maskResumeContent 保持同一语义：只打码手机号与邮箱 */
function maskContent(content: unknown, shouldMask: boolean): unknown {
  if (!shouldMask) return content;
  const cloned = JSON.parse(JSON.stringify(content ?? {}));
  const profile = cloned.profile;
  if (profile) {
    if (typeof profile.phone === 'string' && profile.phone) {
      const digits = profile.phone.replace(/\D/g, '');
      profile.phone = digits.length < 8 ? '*'.repeat(digits.length) : `${digits.slice(0, 3)}****${digits.slice(-4)}`;
    }
    if (typeof profile.email === 'string' && profile.email) {
      const at = profile.email.lastIndexOf('@');
      profile.email = at <= 0 ? '***' : `${profile.email.slice(0, at)[0]}***${profile.email.slice(at)}`;
    }
  }
  return cloned;
}

/** 与服务端 computeApplicationStats 同口径：分母是「已投递」，不含「想投」 */
function computeMockJobStats(rows: Array<{ status: string; nextActionAt: number | null }>) {
  const APPLIED = ['applied', 'interviewing', 'offer', 'rejected'];
  const now = Math.floor(Date.now() / 1000);
  const applied = rows.filter((row) => APPLIED.includes(row.status)).length;
  const interviewing = rows.filter((row) => row.status === 'interviewing').length;
  const offer = rows.filter((row) => row.status === 'offer').length;
  const rate = (n: number) => (applied > 0 ? Math.round((n / applied) * 100) : 0);

  return {
    total: rows.length,
    applied,
    interviewing,
    offer,
    rejected: rows.filter((row) => row.status === 'rejected').length,
    interviewRate: rate(interviewing + offer),
    offerRate: rate(offer),
    dueSoon: rows.filter(
      (row) =>
        row.nextActionAt &&
        row.status !== 'offer' &&
        row.status !== 'rejected' &&
        row.nextActionAt <= now + 7 * 86400
    ).length
  };
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

  // ---- 可观测性上报（公开，永远 204）----
  if (method === 'POST' && path === '/api/telemetry') {
    const events = (body as { events?: Array<{ kind?: string; name?: string; path?: string }> } | null)?.events;
    if (Array.isArray(events)) {
      for (const event of events) {
        if (event && typeof event.name === 'string') {
          state.telemetry.push({ kind: String(event.kind ?? ''), name: event.name, path: event.path });
        }
      }
    }
    await route.fulfill({ status: 204, body: '' });
    return;
  }

  // ---- AI 改写（公开：游客也能用，Key 由用户自带）----
  if (method === 'POST' && path === '/api/ai/models') {
    if (state.aiError) {
      return fail(route, state.aiError.status, state.aiError.code, state.aiError.message);
    }
    return ok(route, { models: state.aiModels });
  }

  if (method === 'POST' && path === '/api/ai/rewrite') {
    if (state.aiError) {
      return fail(route, state.aiError.status, state.aiError.code, state.aiError.message);
    }
    const payload = (body ?? {}) as { text?: string; apiKey?: string; model?: string };
    if (!payload.apiKey) return fail(route, 400, 40009, '请先填写该厂商的 API Key');
    if (!payload.model) return fail(route, 400, 40008, '请填写要调用的模型名');

    const source = String(payload.text ?? '');
    const rewritten =
      state.aiRewriteResult ??
      source
        .split('\n')
        .map((line) => `主导${line.replace(/^[-•·*]\s*/, '')}`)
        .join('\n');

    return ok(route, {
      text: rewritten,
      inputChars: source.length,
      outputChars: rewritten.length
    });
  }

  // ---- 认证 ----
  if (method === 'POST' && (path === '/api/auth/login' || path === '/api/auth/register')) {
    if (state.unauthorized) {
      return fail(route, 401, 40103, '账号或密码错误');
    }
    // 登录时校验密码，改密后的用例才能验证「旧密码失效」
    if (path === '/api/auth/login') {
      const given = (body as { password?: string } | null)?.password ?? '';
      if (given && given !== state.password) {
        return fail(route, 401, 40103, '账号或密码错误');
      }
    }
    // 冷静期内登录 = 自动撤销注销（与服务端一致）
    if (state.deletionRequestedAt !== null) state.deletionRequestedAt = null;
    return ok(route, { token: state.token, user: state.user }, '成功');
  }

  if (method === 'GET' && path === '/api/auth/me') {
    if (!isAuthorized(state, request.headers()['authorization'] ?? null)) {
      return fail(route, 401, 40101, '未授权');
    }
    const daysLeft =
      state.deletionRequestedAt === null
        ? null
        : Math.max(0, Math.ceil((state.deletionRequestedAt + 7 * 86400 - Date.now() / 1000) / 86400));
    return ok(route, {
      ...state.user,
      deletionRequestedAt: state.deletionRequestedAt,
      deletionDaysLeft: daysLeft
    });
  }

  // ---- 账号自助管理 ----
  if (method === 'POST' && path === '/api/auth/password') {
    if (!isAuthorized(state, request.headers()['authorization'] ?? null)) {
      return fail(route, 401, 40101, '请先登录');
    }
    const payload = (body ?? {}) as { currentPassword?: string; newPassword?: string };
    if (payload.currentPassword !== state.password) {
      return fail(route, 401, 40104, '当前密码不正确');
    }
    if (!payload.newPassword || payload.newPassword.length < 6) {
      return fail(route, 400, 40001, '密码至少 6 位');
    }
    if (payload.newPassword === payload.currentPassword) {
      return fail(route, 400, 40001, '新密码不能与当前密码相同');
    }
    state.password = payload.newPassword;
    return ok(route, null, '密码已更新');
  }

  if (method === 'GET' && path === '/api/auth/export') {
    if (!isAuthorized(state, request.headers()['authorization'] ?? null)) {
      return fail(route, 401, 40101, '请先登录');
    }
    const resumes = Array.from(state.resumes.values()).map((r) => ({
      id: r.id,
      title: r.title,
      templateId: r.templateId,
      content: r.content,
      themeConfig: r.themeConfig,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
    return ok(route, {
      format: 'openresume-account-export',
      version: 1,
      exportedAt: Math.floor(Date.now() / 1000),
      account: { id: state.user.id, email: state.user.email, nickname: state.user.nickname, createdAt: null },
      counts: { resumes: resumes.length, versions: 0, shareLinks: 0, applications: state.jobs.size },
      resumes,
      versions: [],
      shareLinks: [],
      applications: Array.from(state.jobs.values())
    });
  }

  if (path === '/api/auth/deletion') {
    if (!isAuthorized(state, request.headers()['authorization'] ?? null)) {
      return fail(route, 401, 40101, '请先登录');
    }

    if (method === 'POST') {
      const given = String((body as { email?: string } | null)?.email ?? '').trim().toLowerCase();
      if (given !== state.user.email.toLowerCase()) {
        return fail(route, 400, 40001, '请输入完整账号邮箱以确认注销');
      }
      state.deletionRequestedAt = Math.floor(Date.now() / 1000);
      return ok(
        route,
        { deletionRequestedAt: state.deletionRequestedAt, deletionDaysLeft: 7 },
        '注销申请已提交，7 天内登录可撤销'
      );
    }

    if (method === 'DELETE') {
      state.deletionRequestedAt = null;
      return ok(route, null, '已撤销注销申请，账号恢复使用');
    }
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
    return ok(route, { counted: true, visitId: 'v_test' });
  }

  // ---- token 化分享（无需鉴权）----
  const tokenGet = path.match(/^\/api\/s\/([^/]+)$/);
  if (method === 'GET' && tokenGet) {
    const link = state.shareLinks.get(tokenGet[1]);
    if (!link) return fail(route, 404, 40401, '该分享链接已失效，请联系求职者重新生成');
    if (link.revokedAt) return fail(route, 410, 41001, '该分享链接已失效，请联系求职者重新生成');
    if (link.expiresAt !== null && link.expiresAt <= Math.floor(Date.now() / 1000)) {
      return fail(route, 410, 41001, '该分享链接已过期，请联系求职者重新生成');
    }
    const record = state.resumes.get(link.resumeId);
    if (!record) return fail(route, 404, 40401, '该简历已被删除');

    if (link.hasPassword) {
      return ok(route, { requiresPassword: true, title: record.title }, '该分享链接需要访问密码');
    }

    link.viewCount += 1;
    return ok(route, {
      requiresPassword: false,
      id: record.id,
      title: record.title,
      templateId: record.templateId,
      content: maskContent(record.content, link.maskContact),
      themeConfig: record.themeConfig,
      allowDownload: link.allowDownload,
      maskContact: link.maskContact,
      updatedAt: record.updatedAt
    });
  }

  const tokenUnlock = path.match(/^\/api\/s\/([^/]+)\/unlock$/);
  if (method === 'POST' && tokenUnlock) {
    const link = state.shareLinks.get(tokenUnlock[1]);
    if (!link) return fail(route, 404, 40401, '该分享链接已失效');
    const password = (body as { password?: string } | null)?.password ?? '';
    if (link.hasPassword && password !== link.password) {
      return fail(route, 401, 40102, '访问密码不正确');
    }
    const record = state.resumes.get(link.resumeId);
    if (!record) return fail(route, 404, 40401, '该简历已被删除');
    return ok(route, {
      requiresPassword: false,
      id: record.id,
      title: record.title,
      templateId: record.templateId,
      content: maskContent(record.content, link.maskContact),
      themeConfig: record.themeConfig,
      allowDownload: link.allowDownload,
      maskContact: link.maskContact,
      updatedAt: record.updatedAt
    });
  }

  if (method === 'POST' && /^\/api\/s\/[^/]+\/visit$/.test(path)) {
    return ok(route, { counted: true, visitId: 'v_test' });
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
        updatedAt: r.updatedAt,
        // 服务端会顺带算完整度；mock 默认给满分，用例可 seed 指定值
        completeness: r.completeness ?? { score: 100, missing: [] }
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
      uniqueVisitors: 0,
      avgDuration: 0,
      totalDownloads: 0
    }));
    return ok(route, list);
  }

  // ---- 投递管理 ----
  if (method === 'GET' && path === '/api/jobs') {
    const rows = Array.from(state.jobs.values())
      .filter((row) => row.userId === state.user.id)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((row) => ({
        ...row,
        resumeTitle: row.resumeId ? state.resumes.get(row.resumeId)?.title ?? null : null
      }));
    return ok(route, { items: rows, stats: computeMockJobStats(rows) });
  }

  if (method === 'POST' && path === '/api/jobs') {
    const payload = (body ?? {}) as Partial<MockJobApplication>;
    if (!payload.company || !payload.position) {
      return fail(route, 400, 40001, '请求参数不合法（company: 必填）');
    }
    const now = Math.floor(Date.now() / 1000);
    const record = state.seedJob({
      company: payload.company,
      position: payload.position,
      location: payload.location ?? null,
      channel: payload.channel ?? null,
      status: payload.status ?? 'applied',
      resumeId: payload.resumeId ?? null,
      appliedAt: payload.appliedAt ?? now,
      nextActionAt: payload.nextActionAt ?? null,
      nextActionNote: payload.nextActionNote ?? null,
      salaryRange: payload.salaryRange ?? null,
      jobUrl: payload.jobUrl ?? null,
      notes: payload.notes ?? null
    });
    return ok(route, { id: record.id, createdAt: now }, '已添加投递记录');
  }

  const jobMatch = path.match(/^\/api\/jobs\/([^/]+)$/);
  if (jobMatch) {
    const id = jobMatch[1];
    const record = state.jobs.get(id);
    if (!record) return fail(route, 404, 40401, '投递记录不存在');

    if (method === 'PATCH') {
      const payload = (body ?? {}) as Partial<MockJobApplication>;
      Object.assign(record, payload, { updatedAt: Math.floor(Date.now() / 1000) });
      return ok(route, { id: record.id, updatedAt: record.updatedAt }, '已更新');
    }

    if (method === 'DELETE') {
      state.jobs.delete(id);
      return ok(route, { id }, '已删除');
    }
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

  const shareLinksMatch = path.match(/^\/api\/resumes\/([^/]+)\/share-links$/);
  if (shareLinksMatch) {
    const resumeId = shareLinksMatch[1];
    const record = state.resumes.get(resumeId);
    if (!record) return fail(route, 404, 40401, '简历不存在');

    if (method === 'GET') {
      const list = Array.from(state.shareLinks.values())
        .filter((link) => link.resumeId === resumeId)
        .map((link) => ({
          id: link.id,
          token: link.token,
          label: link.label,
          url: `/s/${link.token}`,
          expiresAt: link.expiresAt,
          allowDownload: link.allowDownload,
          maskContact: link.maskContact,
          hasPassword: link.hasPassword,
          revokedAt: link.revokedAt,
          viewCount: link.viewCount,
          lastViewedAt: link.lastViewedAt,
          createdAt: link.createdAt,
          status: link.status
        }));
      return ok(route, list);
    }

    if (method === 'POST') {
      const payload = (body ?? {}) as {
        ttl?: string;
        password?: string;
        allowDownload?: boolean;
        maskContact?: boolean;
      };
      const now = Math.floor(Date.now() / 1000);
      const ttlSeconds = payload.ttl === '7d' ? 7 * 86400 : payload.ttl === 'permanent' ? null : 30 * 86400;
      const link = state.seedShareLink(resumeId, {
        expiresAt: ttlSeconds === null ? null : now + ttlSeconds,
        hasPassword: Boolean(payload.password),
        password: payload.password,
        allowDownload: payload.allowDownload !== false,
        maskContact: payload.maskContact !== false,
        createdAt: now
      });
      return ok(route, {
        id: link.id,
        token: link.token,
        url: `/s/${link.token}`,
        hasPassword: link.hasPassword,
        allowDownload: link.allowDownload,
        maskContact: link.maskContact,
        expiresAt: link.expiresAt,
        createdAt: link.createdAt
      }, '分享链接已创建');
    }
  }

  const revokeMatch = path.match(/^\/api\/share-links\/([^/]+)$/);
  if (method === 'DELETE' && revokeMatch) {
    const target = Array.from(state.shareLinks.values()).find((link) => link.id === revokeMatch[1]);
    if (!target) return fail(route, 404, 40401, '分享链接不存在');
    target.revokedAt = Math.floor(Date.now() / 1000);
    target.status = 'revoked';
    return ok(route, { id: target.id }, '分享链接已撤销');
  }

  const versionsMatch = path.match(/^\/api\/resumes\/([^/]+)\/versions$/);
  if (versionsMatch) {
    const record = state.resumes.get(versionsMatch[1]);
    if (!record) return fail(route, 404, 40401, '简历不存在');
    if (method === 'GET') {
      return ok(route, [
        {
          id: 'ver_1',
          label: '投递前定稿',
          title: record.title,
          templateId: record.templateId,
          wordCount: 320,
          source: 'manual',
          createdAt: Math.floor(Date.now() / 1000) - 3600
        },
        {
          id: 'ver_2',
          label: null,
          title: record.title,
          templateId: record.templateId,
          wordCount: 280,
          source: 'auto',
          createdAt: Math.floor(Date.now() / 1000) - 86400
        }
      ]);
    }
    if (method === 'POST') {
      return ok(route, { createdAt: Math.floor(Date.now() / 1000) }, '版本已保存');
    }
  }

  const restoreMatch = path.match(/^\/api\/resumes\/([^/]+)\/versions\/([^/]+)\/restore$/);
  if (method === 'POST' && restoreMatch) {
    const record = state.resumes.get(restoreMatch[1]);
    if (!record) return fail(route, 404, 40401, '简历不存在');
    return ok(route, {
      updatedAt: Math.floor(Date.now() / 1000),
      title: record.title,
      templateId: record.templateId,
      content: record.content,
      themeConfig: record.themeConfig
    }, '已恢复到该版本');
  }

  const analyticsMatch = path.match(/^\/api\/resumes\/([^/]+)\/analytics$/);
  if (method === 'GET' && analyticsMatch) {
    return ok(route, {
      totalViews: 0,
      uniqueVisitors: 0,
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
