import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { sign, verify } from 'hono/jwt';
import { Env } from '../types';
import {
  hashPasswordPBKDF2,
  verifyPassword,
  requireJwtSecret,
  isMissingSecretError
} from '../lib/security';
import {
  expiresAtFrom,
  generateShareToken,
  maskResumeContent,
  resolveShareLinkState,
  shareStateMessage,
  type ShareTtl
} from '../lib/share';
import {
  decideVisit,
  visitorHash,
  VISIT_DEDUP_WINDOW_SECONDS
} from '../lib/visit';
import {
  countWords,
  hashResumeSnapshot,
  shouldWriteVersion,
  VERSION_KEEP_LIMIT
} from '../lib/versions';
import {
  MAX_RESUME_BYTES,
  byteLength,
  clientIp,
  parseStoredJson,
  resolveAllowedOrigin,
  safeParse
} from '../lib/http';
import { checkEmail, checkPassword, normalizeEmail, normalizeNickname } from '../lib/validate';
import { computeCompleteness } from '../lib/completeness';
import { computeApplicationStats, mapApplicationRow } from '../lib/applications';
import { checkRateLimit } from '../lib/rate-limit';
import {
  DELETION_GRACE_SECONDS,
  buildAccountExport,
  deletionDaysLeft,
  exportFileName,
  isDeletionDue
} from '../lib/account';
import {
  createJobApplicationSchema,
  issuesToMessage,
  jobApplicationSchema,
  saveResumeSchema,
  shareLinkSchema,
  validate
} from '../lib/schemas';
import {
  createRequestId,
  logStructured,
  recordServerEvent,
  recordTelemetry
} from '../lib/telemetry';
import {
  buildRewriteMessages,
  callChatCompletion,
  fetchModelList,
  validateModelListRequest,
  validateRewriteRequest
} from '../lib/ai';

const app = new Hono<{ Bindings: Env }>().basePath('/api');

/**
 * CORS：只放行 `APP_ORIGIN` 里列出的源（逗号分隔）。
 *
 * 同源请求不带 `Origin`，返回 undefined 即「不加 CORS 头」，不影响本站使用；
 * 未配置 `APP_ORIGIN` 时任何跨域来源都不放行 —— 本站是 SPA + 同源 API，
 * 唯一需要跨域的是本地 `vite` dev（5173 → 8787），由 .dev.vars 显式配置。
 */
app.use('*', async (c, next) => {
  const origin = resolveAllowedOrigin(c.req.header('Origin'), c.env.APP_ORIGIN);

  if (c.req.method === 'OPTIONS') {
    const headers = new Headers({ Vary: 'Origin' });
    if (origin) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      headers.set('Access-Control-Max-Age', '600');
    }
    return new Response(null, { status: 204, headers });
  }

  await next();

  if (origin) {
    c.res.headers.set('Access-Control-Allow-Origin', origin);
    c.res.headers.set('Vary', 'Origin');
  }
});

/**
 * 可观测性中间件（T5.6）：给每个请求一个 request id，并输出一行结构化日志。
 *
 * 放在 CORS 之后：OPTIONS 预检在 CORS 中间件里直接返回，不该产生日志
 * （一次页面加载就会刷出十几条预检）。
 * 日志里**不记**请求体与查询串 —— 简历正文、分享密码都在里面。
 */
app.use('*', async (c, next) => {
  const requestId = c.req.header('X-Request-Id') || createRequestId();
  const startedAt = Date.now();
  const method = c.req.method;
  // 路径按前缀归一，避免 `/api/resumes/res_xxx` 让日志基数爆掉
  const routePath = c.req.path.replace(/\/[a-z]{2,4}_[A-Za-z0-9]{6,}/g, '/:id');

  c.header('X-Request-Id', requestId);

  try {
    await next();
  } catch (err) {
    logStructured('error', {
      requestId,
      method,
      path: routePath,
      status: 500,
      ms: Date.now() - startedAt,
      err: err instanceof Error ? err.message : String(err)
    });
    throw err;
  }

  const status = c.res.status;

  /*
   * AI 网关的 5xx 不算本站故障。
   *
   * `/api/ai/*` 的 502/504 说的是「用户自己配的模型服务商拒绝了这次请求」——
   * Key 填错、余额不足、模型名过期都会走到这里。把它计入 `server.error.*`，
   * 一个填错 Key 的用户就能让「5xx > 20 次/天」的告警响一整晚，
   * 而这个告警本来的用途是「我们的服务坏了」。
   */
  const isGatewayPath = routePath.startsWith('/api/ai/');
  const level = status >= 500 ? (isGatewayPath ? 'warn' : 'error') : status >= 400 ? 'warn' : 'info';

  logStructured(level, {
    requestId,
    method,
    path: routePath,
    status,
    ms: Date.now() - startedAt
  });

  // 只统计服务端错误，且按路径聚合 —— 这是「D1 错误率」告警的唯一数据源
  if (status >= 500 && !isGatewayPath) {
    void recordServerEvent(c.env.DB, `server.error.${status}`, { path: routePath });
  }
});


/** 统一返回「触发限流」；客户端按 Retry-After 退避即可，不需要额外语义 */
function rateLimitResponse(c: any, retryAfterSeconds: number) {
  return c.json(
    { code: 42901, message: `操作过于频繁，请 ${retryAfterSeconds} 秒后再试`, data: null },
    429,
    { 'Retry-After': String(retryAfterSeconds) }
  );
}

/**
 * 记一次服务端业务事件。
 *
 * 用 `waitUntil` 让写入在响应之后继续：埋点慢一点没关系，但绝不能让
 * 「记埋点」的 D1 延迟出现在用户等待的登录响应里。拿不到 executionCtx
 * （例如单测里直接调用 handler）时退化为 fire-and-forget。
 */
function trackServer(c: any, name: string, path?: string) {
  const task = recordServerEvent(c.env.DB, name, { path });
  try {
    c.executionCtx?.waitUntil(task);
  } catch {
    // 没有 executionCtx：让它自己跑完，不阻塞响应
    void task;
  }
}

/**
 * 从请求体里读一个对象。
 *
 * 与裸 `c.req.json()` 的区别：空 body / 非 JSON / 顶层不是对象 都退化为 `{}`，
 * 让后续「字段缺失」的分支统一返回 40001，而不是抛 500。
 */
async function readJsonBody(c: any): Promise<Record<string, any>> {
  try {
    const parsed = await c.req.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return {};
  } catch {
    return {};
  }
}

// 鉴权中间件辅助函数
async function getAuthUserId(c: any): Promise<string | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    // 密钥缺失时抛错，由调用方决定返回 50003，而不是把所有人当成未登录
    const payload = await verify(token, requireJwtSecret(c.env), 'HS256');
    return (payload as any).userId || null;
  } catch {
    return null;
  }
}

/** 把密钥缺失映射为可诊断的 50003，避免暴露堆栈细节 */
function secretErrorResponse(c: any) {
  return c.json(
    { code: 50003, message: '服务端未配置 JWT_SECRET，请管理员注入环境变量', data: null },
    500
  );
}

/**
 * 写入版本快照（内容变了 + 距上次 ≥10 分钟）。
 *
 * 返回是否真的写入，便于路由层在响应里告知前端「本次生成了新版本」。
 * 失败只抛出，由调用方决定是否吞掉 —— 快照永远不能阻断保存。
 */
async function maybeSnapshotVersion(
  c: any,
  input: {
    resumeId: string;
    userId: string;
    title: string;
    templateId: string;
    content: any;
    themeConfig: any;
    now: number;
    source?: 'auto' | 'manual';
    label?: string;
  }
): Promise<boolean> {
  const hash = await hashResumeSnapshot({
    title: input.title,
    templateId: input.templateId,
    content: input.content,
    themeConfig: input.themeConfig
  });

  const last: any = await c.env.DB.prepare(
    'SELECT content_hash, created_at FROM resume_versions WHERE resume_id = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(input.resumeId).first();

  const decision = shouldWriteVersion({
    hash,
    lastHash: last?.content_hash ?? null,
    lastCreatedAt: typeof last?.created_at === 'number' ? last.created_at : null,
    nowSeconds: input.now,
    source: input.source
  });

  if (!decision.write) return false;

  const versionId = `ver_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await c.env.DB.prepare(
    `INSERT INTO resume_versions
       (id, resume_id, user_id, label, title, template_id, content, theme_config,
        content_hash, word_count, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    versionId,
    input.resumeId,
    input.userId,
    input.label || null,
    input.title,
    input.templateId,
    JSON.stringify(input.content || {}),
    JSON.stringify(input.themeConfig || {}),
    hash,
    countWords(input.content),
    input.source || 'auto',
    input.now
  ).run();

  // 只保留最近 20 个：手动命名的版本优先保留
  await c.env.DB.prepare(
    `DELETE FROM resume_versions
      WHERE resume_id = ?
        AND id NOT IN (
          SELECT id FROM resume_versions
           WHERE resume_id = ?
           ORDER BY (label IS NOT NULL) DESC, created_at DESC
           LIMIT ?
        )`
  ).bind(input.resumeId, input.resumeId, VERSION_KEEP_LIMIT).run().catch(() => {});

  return true;
}

/**
 * 删除一个账号及其全部关联数据。
 *
 * D1 默认不开外键级联，所以逐表显式删除。顺序按「子表 → 主表」，
 * 单表失败不阻断后续（删一半比删不掉更糟：残留行会永远挂在库里）。
 *
 * R2 里的头像不在这里删：Workers 环境里列表前缀需要分页遍历，
 * 且头像体积小、无个人身份信息。真正的清理由 `scripts/purge-accounts.mjs`
 * 在带 R2 绑定的环境下做。
 */
async function purgeUserAccount(db: D1Database, userId: string): Promise<void> {
  const statements = [
    'DELETE FROM resume_versions WHERE user_id = ?',
    'DELETE FROM share_links WHERE user_id = ?',
    'DELETE FROM job_applications WHERE user_id = ?',
    // 访问记录按简历归属删：表里没有 user_id
    'DELETE FROM resume_visits WHERE resume_id IN (SELECT id FROM resumes WHERE user_id = ?)',
    'DELETE FROM resumes WHERE user_id = ?'
  ];

  for (const sql of statements) {
    try {
      await db.prepare(sql).bind(userId).run();
    } catch (err) {
      console.error('注销清理失败，继续后续表:', sql, err);
    }
  }

  try {
    await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  } catch (err) {
    console.error('注销时删除用户失败:', err);
  }
}

// ======================= 1. 认证模块 (Auth) =======================

// 1.1 用户注册
app.post('/auth/register', async (c) => {
  const ip = clientIp(c.req.raw.headers);
  const limit = await checkRateLimit(c.env.DB, { action: 'register', ip });
  if (!limit.allowed) return rateLimitResponse(c, limit.retryAfterSeconds);

  const body = await readJsonBody(c);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  const emailError = checkEmail(email);
  if (emailError) return c.json({ code: 40001, message: emailError, data: null }, 400);

  const passwordError = checkPassword(password);
  if (passwordError) return c.json({ code: 40001, message: passwordError, data: null }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return c.json({ code: 40002, message: '该邮箱已被注册', data: null }, 400);
  }

  const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const passwordHash = await hashPasswordPBKDF2(password);
  const userNick = normalizeNickname(body.nickname, email);

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, nickname) VALUES (?, ?, ?, ?)'
  ).bind(userId, email, passwordHash, userNick).run();

  let token: string;
  try {
    token = await sign(
      { userId, email, exp: Math.floor(Date.now() / 1000) + 7 * 86400 },
      requireJwtSecret(c.env)
    );
  } catch (err) {
    if (isMissingSecretError(err)) return secretErrorResponse(c);
    throw err;
  }

  trackServer(c, 'auth.register.ok');

  return c.json({
    code: 0,
    message: '注册成功',
    data: {
      token,
      user: { id: userId, email, nickname: userNick }
    }
  });
});

// 1.2 用户登录
app.post('/auth/login', async (c) => {
  const ip = clientIp(c.req.raw.headers);
  const limit = await checkRateLimit(c.env.DB, { action: 'login', ip });
  if (!limit.allowed) return rateLimitResponse(c, limit.retryAfterSeconds);

  const body = await readJsonBody(c);
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return c.json({ code: 40001, message: '邮箱与密码不能为空', data: null }, 400);
  }
  // 长度上限防「超长密码」拖慢 PBKDF2；不在此处限制下限，避免历史弱密码用户被锁在门外
  if (password.length > 128) {
    return c.json({ code: 40001, message: '密码不能超过 128 位', data: null }, 400);
  }

  const user: any = await c.env.DB.prepare(
    'SELECT id, email, nickname, avatar_url, password_hash, deletion_requested_at FROM users WHERE email = ?'
  ).bind(email).first();

  if (!user) {
    // 只记「失败了一次」，不记是谁 —— 失败率告警不需要知道账号
    trackServer(c, 'auth.login.fail');
    return c.json({ code: 40103, message: '账号或密码错误', data: null }, 401);
  }

  const { isValid, needsUpgrade } = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    trackServer(c, 'auth.login.fail');
    return c.json({ code: 40103, message: '账号或密码错误', data: null }, 401);
  }

  // 注销冷静期已过：密码正确就执行删除，再告知账号已注销。
  // 不在这里直接删会让「7 天到了但没人跑清理脚本」的账号一直存活。
  if (isDeletionDue(user.deletion_requested_at)) {
    await purgeUserAccount(c.env.DB, user.id);
    return c.json(
      { code: 40105, message: '该账号已按申请完成注销', data: null },
      401
    );
  }

  // 冷静期内登录 = 后悔了：自动撤销注销，省掉「再去找撤销入口」这一步
  if (user.deletion_requested_at) {
    await c.env.DB.prepare('UPDATE users SET deletion_requested_at = NULL WHERE id = ?')
      .bind(user.id)
      .run();
  }

  // 若为旧格式密码哈希，平滑自动升级为 PBKDF2
  if (needsUpgrade) {
    try {
      const upgradedHash = await hashPasswordPBKDF2(password);
      await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(upgradedHash, user.id).run();
    } catch (err) {
      console.error('密码哈希升级失败:', err);
    }
  }

  let token: string;
  try {
    token = await sign(
      { userId: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 7 * 86400 },
      requireJwtSecret(c.env)
    );
  } catch (err) {
    if (isMissingSecretError(err)) return secretErrorResponse(c);
    throw err;
  }

  return c.json({
    code: 0,
    message: '登录成功',
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatarUrl: user.avatar_url
      }
    }
  });
});

// 1.3 获取登录个人信息
app.get('/auth/me', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) {
    return c.json({ code: 40101, message: '未授权或登录过期', data: null }, 401);
  }

  const user: any = await c.env.DB.prepare(
    'SELECT id, email, nickname, avatar_url, created_at, deletion_requested_at FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user) return c.json({ code: 40401, message: '用户不存在', data: null }, 404);

  return c.json({
    code: 0,
    message: 'success',
    data: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
      // 注销冷静期：前端据此在设置页显示「还剩 N 天」并给撤销入口
      deletionRequestedAt: user.deletion_requested_at ?? null,
      deletionDaysLeft: deletionDaysLeft(user.deletion_requested_at)
    }
  });
});

// 1.4 修改密码
//
// 必须校验旧密码：只有 JWT 就能改密码，等于把「token 泄露」升级成「永久接管账号」。
// 改完后旧 token 仍有效（JWT 是无状态的），这是刻意取舍 ——
// 让用户自己改密码就把其他设备踢下线，在共享设备场景反而是坏事；
// 真正的「踢下线」要靠「改密后让 token 版本号失效」，需要多存一列，
// 收益不足以抵消成本。
app.post('/auth/password', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const ip = clientIp(c.req.raw.headers);
  const limit = await checkRateLimit(c.env.DB, { action: 'login', ip });
  if (!limit.allowed) return rateLimitResponse(c, limit.retryAfterSeconds);

  const body = await readJsonBody(c);
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  const passwordError = checkPassword(newPassword);
  if (passwordError) return c.json({ code: 40001, message: passwordError, data: null }, 400);

  const user: any = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(userId)
    .first();
  if (!user) return c.json({ code: 40401, message: '用户不存在', data: null }, 404);

  const { isValid } = await verifyPassword(currentPassword, user.password_hash);
  if (!isValid) return c.json({ code: 40104, message: '当前密码不正确', data: null }, 401);

  if (currentPassword === newPassword) {
    return c.json({ code: 40001, message: '新密码不能与当前密码相同', data: null }, 400);
  }

  const passwordHash = await hashPasswordPBKDF2(newPassword);
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = unixepoch() WHERE id = ?')
    .bind(passwordHash, userId)
    .run();

  return c.json({ code: 0, message: '密码已更新', data: null });
});

// 1.5 导出账号数据（JSON）
//
// 只导出用户自己的内容：简历、版本、分享链接、投递记录。
// **不含**访问统计（那是别人的浏览行为）与 password_hash（只会增加泄露面）。
app.get('/auth/export', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const user: any = await c.env.DB.prepare(
    'SELECT id, email, nickname, created_at FROM users WHERE id = ?'
  ).bind(userId).first();
  if (!user) return c.json({ code: 40401, message: '用户不存在', data: null }, 404);

  // 逐表读取；单表失败不该让整份导出变成 500，缺的表按空数组处理
  const readAll = async (sql: string) => {
    try {
      const result: any = await c.env.DB.prepare(sql).bind(userId).all();
      return (result?.results ?? []) as Array<Record<string, unknown>>;
    } catch (err) {
      console.error('导出时读取失败，已跳过该表:', err);
      return [];
    }
  };

  const [resumes, versions, shareLinks, applications] = await Promise.all([
    readAll('SELECT id, title, template_id, content, theme_config, is_public, created_at, updated_at FROM resumes WHERE user_id = ?'),
    readAll('SELECT id, resume_id, label, title, template_id, content, theme_config, word_count, source, created_at FROM resume_versions WHERE user_id = ?'),
    readAll('SELECT id, resume_id, token, label, expires_at, allow_download, mask_contact, revoked_at, view_count, created_at FROM share_links WHERE user_id = ?'),
    readAll('SELECT id, resume_id, company, position, location, channel, status, applied_at, next_action_at, next_action_note, salary_range, job_url, notes, created_at, updated_at FROM job_applications WHERE user_id = ?')
  ]);

  const payload = buildAccountExport({
    user: { id: user.id, email: user.email, nickname: user.nickname, createdAt: user.created_at },
    resumes,
    versions,
    shareLinks,
    applications
  });

  return c.json(
    { code: 0, message: 'success', data: payload },
    200,
    { 'Content-Disposition': `attachment; filename="${exportFileName(user.email)}"` }
  );
});

// 1.6 申请注销账号（7 天冷静期）
app.post('/auth/deletion', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const body = await readJsonBody(c);
  const user: any = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first();
  if (!user) return c.json({ code: 40401, message: '用户不存在', data: null }, 404);

  // 二次确认：必须原样输入自己的邮箱。误点一下就把账号送进删除倒计时，代价太大。
  const confirmation = normalizeEmail(body.email);
  if (confirmation !== normalizeEmail(user.email)) {
    return c.json({ code: 40001, message: '请输入完整账号邮箱以确认注销', data: null }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare('UPDATE users SET deletion_requested_at = ? WHERE id = ?')
    .bind(now, userId)
    .run();

  return c.json({
    code: 0,
    message: `注销申请已提交，${DELETION_GRACE_SECONDS / 86400} 天内登录可撤销`,
    data: { deletionRequestedAt: now, deletionDaysLeft: deletionDaysLeft(now) }
  });
});

// 1.7 撤销注销
app.delete('/auth/deletion', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  await c.env.DB.prepare('UPDATE users SET deletion_requested_at = NULL WHERE id = ?')
    .bind(userId)
    .run();

  return c.json({ code: 0, message: '已撤销注销申请，账号恢复使用', data: null });
});

// ======================= 2. 简历管理模块 (Resumes) =======================

// 2.1 获取我的简历列表 (轻量元数据)
//
// 完整度在服务端算：列表本来就要读 content 才能算，而前端若为每张卡片
// 单独拉一次详情就是 N+1。只返回一个 0–100 的数字与「还差什么」的 key，
// 不返回正文，列表体积基本不变。
app.get('/resumes', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT id, title, template_id as templateId, is_public as isPublic,
            content, created_at as createdAt, updated_at as updatedAt
       FROM resumes WHERE user_id = ? ORDER BY updated_at DESC`
  ).bind(userId).all();

  const rows = (results || []).map((row: any) => {
    const { content, ...rest } = row;
    const parsed = safeParse<Record<string, unknown>>(content, {});
    const completeness = computeCompleteness(parsed);
    return { ...rest, completeness };
  });

  return c.json({ code: 0, message: 'success', data: rows });
});

// 2.2 创建一份新简历
app.post('/resumes', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const raw = await readJsonBody(c);
  const checked = validate(saveResumeSchema, raw);
  if (!checked.ok) {
    return c.json({ code: 40001, message: issuesToMessage(checked.issues), data: null }, 400);
  }
  const body = checked.data as Record<string, any>;

  const resumeId = `res_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const title = body.title || '未命名求职简历';
  const templateId = body.templateId || 'classic';
  const content = JSON.stringify(body.content || {});
  const themeConfig = JSON.stringify(body.themeConfig || {});

  // 本地草稿迁移（登录后首次上云）走的就是这个接口，体积同样要有上限
  if (byteLength(content) + byteLength(themeConfig) > MAX_RESUME_BYTES) {
    return c.json({ code: 40002, message: '简历体积超出上限（512KB）', data: null }, 413);
  }

  await c.env.DB.prepare(
    'INSERT INTO resumes (id, user_id, title, template_id, content, theme_config) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(resumeId, userId, title, templateId, content, themeConfig).run();

  return c.json({
    code: 0,
    message: '创建成功',
    data: { id: resumeId, title, templateId }
  });
});

// 2.3 获取单份简历详情
app.get('/resumes/:id', async (c) => {
  const userId = await getAuthUserId(c);
  const resumeId = c.req.param('id');

  const resume: any = await c.env.DB.prepare(
    'SELECT * FROM resumes WHERE id = ?'
  ).bind(resumeId).first();

  if (!resume) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (resume.user_id !== userId && resume.is_public !== 1) {
    return c.json({ code: 40301, message: '无权查看该私有简历', data: null }, 403);
  }

  const content = parseStoredJson(resume.content, {} as any);
  // 正文损坏时不能返回空简历：前端拿到 {} 会当作「用户清空了内容」并立刻回写覆盖
  if (content.corrupt) {
    console.error('简历正文 JSON 损坏:', resume.id);
    return c.json({ code: 50001, message: '简历数据已损坏，请从版本历史恢复', data: null }, 500);
  }

  return c.json({
    code: 0,
    message: 'success',
    data: {
      id: resume.id,
      // 不返回 userId：公开简历（is_public=1）任何人可读，没必要暴露所有者标识
      title: resume.title,
      templateId: resume.template_id,
      content: content.value,
      themeConfig: safeParse(resume.theme_config, {}),
      isPublic: resume.is_public,
      updatedAt: resume.updated_at
    }
  });
});

// 2.4 保存更新简历
app.put('/resumes/:id', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');

  // 先按 Content-Length 快速拒绝，避免把几十 MB 的 body 全读进内存再判断
  const declaredLength = Number(c.req.header('Content-Length') || 0);
  if (declaredLength > MAX_RESUME_BYTES) {
    return c.json({ code: 40002, message: '简历体积超出上限（512KB）', data: null }, 413);
  }

  const rawBody = await c.req.text();
  if (byteLength(rawBody) > MAX_RESUME_BYTES) {
    return c.json({ code: 40002, message: '简历体积超出上限（512KB）', data: null }, 413);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return c.json({ code: 40001, message: '请求体不是合法的 JSON', data: null }, 400);
  }

  // 结构校验：字段类型/长度不对时明确告诉用户哪一项有问题，
  // 而不是把脏数据写进库、等渲染时才炸
  const checked = validate(saveResumeSchema, parsed);
  if (!checked.ok) {
    return c.json({ code: 40001, message: issuesToMessage(checked.issues), data: null }, 400);
  }
  const body = checked.data as Record<string, any>;

  const existing: any = await c.env.DB.prepare('SELECT user_id, is_public FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!existing) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (existing.user_id !== userId) return c.json({ code: 40301, message: '无权修改该简历', data: null }, 403);

  const now = Math.floor(Date.now() / 1000);
  const isPublicVal = typeof body.isPublic === 'number' ? body.isPublic : (body.isPublic ? 1 : (body.isPublic === false ? 0 : existing.is_public));

  await c.env.DB.prepare(
    'UPDATE resumes SET title = ?, template_id = ?, content = ?, theme_config = ?, is_public = ?, updated_at = ? WHERE id = ?'
  ).bind(
    body.title || '未命名简历',
    body.templateId || 'classic',
    JSON.stringify(body.content || {}),
    JSON.stringify(body.themeConfig || {}),
    isPublicVal,
    now,
    resumeId
  ).run();

  // 版本快照：内容哈希变化 + 距上次 ≥10 分钟才写（见 functions/lib/versions.ts）
  try {
    await maybeSnapshotVersion(c, {
      resumeId,
      userId,
      title: body.title || '未命名简历',
      templateId: body.templateId || 'classic',
      content: body.content || {},
      themeConfig: body.themeConfig || {},
      now,
      source: 'auto'
    });
  } catch (err) {
    // 快照失败不能影响保存本身
    console.error('自动保存版本快照失败:', err);
  }

  return c.json({
    code: 0,
    message: '保存成功',
    data: { id: resumeId, updatedAt: now, isPublic: isPublicVal }
  });
});

// 2.5 重命名简历（只改标题，不触碰 content/themeConfig）
// 与 PUT 分开：PUT 需要完整正文，缺字段时会把内容写成 {}，不适合列表页改名
app.patch('/resumes/:id', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const body = await readJsonBody(c);
  const title = typeof body.title === 'string' ? body.title.trim() : '';

  if (title.length < 1 || title.length > 100) {
    return c.json({ code: 40001, message: '标题需为 1-100 个字符', data: null }, 400);
  }

  const existing: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!existing) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (existing.user_id !== userId) return c.json({ code: 40301, message: '无权修改该简历', data: null }, 403);

  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare('UPDATE resumes SET title = ?, updated_at = ? WHERE id = ?')
    .bind(title, now, resumeId)
    .run();

  return c.json({
    code: 0,
    message: '更新成功',
    data: { id: resumeId, title, updatedAt: now }
  });
});

// 2.6 切换简历公开分享开关
app.post('/resumes/:id/share', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const body = await readJsonBody(c);
  const isPublic = body.isPublic ? 1 : 0;

  const existing: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!existing) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (existing.user_id !== userId) return c.json({ code: 40301, message: '无权修改该简历', data: null }, 403);

  await c.env.DB.prepare('UPDATE resumes SET is_public = ? WHERE id = ?').bind(isPublic, resumeId).run();

  return c.json({
    code: 0,
    message: isPublic === 1 ? '已开启公开分享' : '已关闭公开分享',
    data: { id: resumeId, isPublic }
  });
});

// 2.6.1 列出该简历的全部分享链接（含已撤销，便于审计）
app.get('/resumes/:id/share-links', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const resume: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?')
    .bind(resumeId)
    .first();
  if (!resume) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (resume.user_id !== userId) return c.json({ code: 40301, message: '无权查看该简历的分享链接', data: null }, 403);

  const { results } = await c.env.DB.prepare(
    `SELECT id, token, label, expires_at, allow_download, mask_contact, revoked_at,
            view_count, last_viewed_at, created_at,
            (password_hash IS NOT NULL) AS has_password
       FROM share_links
      WHERE resume_id = ?
      ORDER BY created_at DESC
      LIMIT 50`
  ).bind(resumeId).all();

  const now = Math.floor(Date.now() / 1000);
  return c.json({
    code: 0,
    message: 'success',
    data: (results || []).map((row: any) => ({
      id: row.id,
      token: row.token,
      label: row.label || '',
      url: `/s/${row.token}`,
      expiresAt: row.expires_at ?? null,
      allowDownload: Number(row.allow_download) === 1,
      maskContact: Number(row.mask_contact) === 1,
      hasPassword: Number(row.has_password) === 1,
      revokedAt: row.revoked_at ?? null,
      viewCount: Number(row.view_count) || 0,
      lastViewedAt: row.last_viewed_at ?? null,
      createdAt: row.created_at,
      status: resolveShareLinkState(row as any, now)
    }))
  });
});

// 2.6.2 新建分享链接（token / 有效期 / 密码 / 脱敏 / 是否允许下载）
app.post('/resumes/:id/share-links', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const resume: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?')
    .bind(resumeId)
    .first();
  if (!resume) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (resume.user_id !== userId) return c.json({ code: 40301, message: '无权为该简历创建分享链接', data: null }, 403);

  const raw = await readJsonBody(c);
  const checked = validate(shareLinkSchema, raw);
  if (!checked.ok) {
    return c.json({ code: 40001, message: issuesToMessage(checked.issues), data: null }, 400);
  }
  const body = checked.data;

  const ttl: ShareTtl = body.ttl ?? '30d';

  const rawPassword = typeof body.password === 'string' ? body.password.trim() : '';
  if (rawPassword && (rawPassword.length < 4 || rawPassword.length > 64)) {
    return c.json({ code: 40001, message: '访问密码需为 4-64 个字符', data: null }, 400);
  }

  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 50) : '';

  const id = `sl_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  // token 撞库概率极低，但唯一索引冲突时必须换一个而不是 500
  let token = generateShareToken();
  for (let attempt = 0; attempt < 3; attempt++) {
    const exists = await c.env.DB.prepare('SELECT id FROM share_links WHERE token = ?')
      .bind(token)
      .first();
    if (!exists) break;
    token = generateShareToken();
  }

  const now = Math.floor(Date.now() / 1000);
  const passwordHash = rawPassword ? await hashPasswordPBKDF2(rawPassword) : null;

  await c.env.DB.prepare(
    `INSERT INTO share_links
       (id, resume_id, user_id, token, label, password_hash, expires_at,
        allow_download, mask_contact, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    resumeId,
    userId,
    token,
    label || null,
    passwordHash,
    expiresAtFrom(ttl, now),
    body.allowDownload === false ? 0 : 1,
    body.maskContact === false ? 0 : 1,
    now
  ).run();

  return c.json({
    code: 0,
    message: '分享链接已创建',
    data: {
      id,
      token,
      url: `/s/${token}`,
      hasPassword: Boolean(passwordHash),
      allowDownload: body.allowDownload !== false,
      maskContact: body.maskContact !== false,
      expiresAt: expiresAtFrom(ttl, now),
      createdAt: now
    }
  });
});

// 2.6.3 撤销分享链接（软删除，保留审计痕迹）
app.delete('/share-links/:id', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const linkId = c.req.param('id');
  const link: any = await c.env.DB.prepare('SELECT user_id FROM share_links WHERE id = ?')
    .bind(linkId)
    .first();
  if (!link) return c.json({ code: 40401, message: '分享链接不存在', data: null }, 404);
  if (link.user_id !== userId) return c.json({ code: 40301, message: '无权撤销该分享链接', data: null }, 403);

  await c.env.DB.prepare('UPDATE share_links SET revoked_at = ? WHERE id = ?')
    .bind(Math.floor(Date.now() / 1000), linkId)
    .run();

  return c.json({ code: 0, message: '分享链接已撤销', data: { id: linkId } });
});

// 2.7 删除简历 (显式级联清理关联历史与访问记录)
app.delete('/resumes/:id', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const existing: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!existing) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (existing.user_id !== userId) return c.json({ code: 40301, message: '无权删除该简历', data: null }, 403);

  // 显式清理关联表，确保 D1 无外键级联模式下无孤儿行残留
  await c.env.DB.prepare('DELETE FROM resume_versions WHERE resume_id = ?').bind(resumeId).run().catch(() => {});
  await c.env.DB.prepare('DELETE FROM resume_visits WHERE resume_id = ?').bind(resumeId).run().catch(() => {});
  await c.env.DB.prepare('DELETE FROM share_links WHERE resume_id = ?').bind(resumeId).run().catch(() => {});
  await c.env.DB.prepare('DELETE FROM resumes WHERE id = ?').bind(resumeId).run();
  return c.json({ code: 0, message: '删除成功', data: { id: resumeId } });
});

// 2.8 获取求职投递反馈与阅读足迹统计 (HR Read Analytics)
app.get('/resumes/:id/analytics', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const resume: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!resume) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (resume.user_id !== userId) return c.json({ code: 40301, message: '无权查看该简历统计', data: null }, 403);

  // is_bot = 0：爬虫/预取不计入；uniqueVisitors 按访客指纹去重
  const stats: any = await c.env.DB.prepare(
    `SELECT COUNT(*) AS totalViews,
            COUNT(DISTINCT visitor_hash) AS uniqueVisitors,
            AVG(duration_seconds) AS avgDuration,
            SUM(is_downloaded) AS totalDownloads
       FROM resume_visits
      WHERE resume_id = ? AND is_bot = 0`
  ).bind(resumeId).first();

  const { results: recent } = await c.env.DB.prepare(
    `SELECT id, duration_seconds AS duration, is_downloaded AS isDownloaded,
            country, referer, created_at AS createdAt
       FROM resume_visits
      WHERE resume_id = ? AND is_bot = 0
      ORDER BY created_at DESC
      LIMIT 10`
  ).bind(resumeId).all();

  return c.json({
    code: 0,
    message: 'success',
    data: {
      totalViews: stats?.totalViews || 0,
      uniqueVisitors: stats?.uniqueVisitors || 0,
      avgDuration: Math.round(stats?.avgDuration || 0),
      totalDownloads: stats?.totalDownloads || 0,
      recentVisits: recent || []
    }
  });
});

// 2.9 全部简历的访问汇总（一条查询替代 N 次 /resumes/:id/analytics）
app.get('/analytics/overview', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const { results } = await c.env.DB.prepare(
    `SELECT r.id AS resumeId,
            COUNT(v.id) AS totalViews,
            COUNT(DISTINCT v.visitor_hash) AS uniqueVisitors,
            COALESCE(AVG(v.duration_seconds), 0) AS avgDuration,
            COALESCE(SUM(v.is_downloaded), 0) AS totalDownloads
       FROM resumes r
       LEFT JOIN resume_visits v ON v.resume_id = r.id AND v.is_bot = 0
      WHERE r.user_id = ?
      GROUP BY r.id`
  ).bind(userId).all();

  return c.json({
    code: 0,
    message: 'success',
    data: (results || []).map((row: any) => ({
      resumeId: row.resumeId,
      totalViews: Number(row.totalViews) || 0,
      uniqueVisitors: Number(row.uniqueVisitors) || 0,
      avgDuration: Math.round(Number(row.avgDuration) || 0),
      totalDownloads: Number(row.totalDownloads) || 0
    }))
  });
});

// 2.10 版本列表
app.get('/resumes/:id/versions', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const resume: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!resume) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (resume.user_id !== userId) return c.json({ code: 40301, message: '无权查看版本历史', data: null }, 403);

  const { results } = await c.env.DB.prepare(
    `SELECT id, label, title, template_id AS templateId, word_count AS wordCount,
            source, created_at AS createdAt
       FROM resume_versions
      WHERE resume_id = ?
      ORDER BY created_at DESC
      LIMIT ?`
  ).bind(resumeId, VERSION_KEEP_LIMIT).all();

  return c.json({ code: 0, message: 'success', data: results || [] });
});

// 2.11 手动创建版本（命名快照，不受 10 分钟间隔限制）
app.post('/resumes/:id/versions', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const resume: any = await c.env.DB.prepare(
    'SELECT user_id, title, template_id, content, theme_config FROM resumes WHERE id = ?'
  ).bind(resumeId).first();
  if (!resume) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (resume.user_id !== userId) return c.json({ code: 40301, message: '无权创建版本', data: null }, 403);

  const body = await readJsonBody(c);
  const label = typeof body.label === 'string' ? body.label.trim().slice(0, 50) : '';
  const now = Math.floor(Date.now() / 1000);

  const content = safeParse<any>(resume.content, {});
  const themeConfig = safeParse<any>(resume.theme_config, {});

  const written = await maybeSnapshotVersion(c, {
    resumeId,
    userId,
    title: resume.title,
    templateId: resume.template_id,
    content,
    themeConfig,
    now,
    source: 'manual',
    label: label || `手动保存 ${new Date(now * 1000).toLocaleString('zh-CN')}`
  });

  if (!written) {
    return c.json({ code: 40006, message: '内容与最近一个版本相同，无需重复保存', data: null }, 400);
  }

  return c.json({ code: 0, message: '版本已保存', data: { createdAt: now } });
});

// 2.12 版本详情（含内容，供预览）
app.get('/resumes/:id/versions/:versionId', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const versionId = c.req.param('versionId');

  const resume: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!resume || resume.user_id !== userId) return c.json({ code: 40301, message: '无权操作', data: null }, 403);

  const row: any = await c.env.DB.prepare(
    `SELECT id, label, title, template_id, content, theme_config, word_count, source, created_at
       FROM resume_versions WHERE id = ? AND resume_id = ?`
  ).bind(versionId, resumeId).first();
  if (!row) return c.json({ code: 40401, message: '版本不存在', data: null }, 404);

  return c.json({
    code: 0,
    message: 'success',
    data: {
      id: row.id,
      label: row.label || '',
      title: row.title,
      templateId: row.template_id,
      content: safeParse<any>(row.content, {}),
      themeConfig: safeParse<any>(row.theme_config, {}),
      wordCount: row.word_count,
      source: row.source,
      createdAt: row.created_at
    }
  });
});

// 2.13 恢复到指定版本（恢复前先把当前状态存成 restore 快照，可再撤回）
app.post('/resumes/:id/versions/:versionId/restore', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const versionId = c.req.param('versionId');

  const resume: any = await c.env.DB.prepare(
    'SELECT user_id, title, template_id, content, theme_config FROM resumes WHERE id = ?'
  ).bind(resumeId).first();
  if (!resume) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (resume.user_id !== userId) return c.json({ code: 40301, message: '无权操作', data: null }, 403);

  const row: any = await c.env.DB.prepare(
    'SELECT title, template_id, content, theme_config FROM resume_versions WHERE id = ? AND resume_id = ?'
  ).bind(versionId, resumeId).first();
  if (!row) return c.json({ code: 40401, message: '版本不存在', data: null }, 404);

  const now = Math.floor(Date.now() / 1000);

  // 先备份当前状态：恢复本身也是一次「改动」，用户可能马上后悔
  try {
    const currentContent = safeParse<any>(resume.content, {});
    const currentTheme = safeParse<any>(resume.theme_config, {});
    await maybeSnapshotVersion(c, {
      resumeId,
      userId,
      title: resume.title,
      templateId: resume.template_id,
      content: currentContent,
      themeConfig: currentTheme,
      now,
      source: 'manual',
      label: '恢复前自动备份'
    });
  } catch (err) {
    console.error('恢复前备份失败:', err);
  }

  await c.env.DB.prepare(
    'UPDATE resumes SET title = ?, template_id = ?, content = ?, theme_config = ?, updated_at = ? WHERE id = ?'
  ).bind(
    row.title || '未命名简历',
    row.template_id || 'classic',
    row.content,
    row.theme_config,
    now,
    resumeId
  ).run();

  return c.json({
    code: 0,
    message: '已恢复到该版本',
    data: {
      updatedAt: now,
      title: row.title,
      templateId: row.template_id,
      content: safeParse<any>(row.content, {}),
      themeConfig: safeParse<any>(row.theme_config, {})
    }
  });
});

// 2.14 删除版本
app.delete('/resumes/:id/versions/:versionId', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const versionId = c.req.param('versionId');

  const resume: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!resume || resume.user_id !== userId) return c.json({ code: 40301, message: '无权操作', data: null }, 403);

  await c.env.DB.prepare('DELETE FROM resume_versions WHERE id = ? AND resume_id = ?')
    .bind(versionId, resumeId)
    .run();

  return c.json({ code: 0, message: '版本已删除', data: { id: versionId } });
});

// 2.15 兼容旧路由：/history 与 /restore/:historyId
// 老客户端（或用户书签）可能仍在调用，保留映射避免直接 404
app.get('/resumes/:id/history', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const resume: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!resume || resume.user_id !== userId) return c.json({ code: 40301, message: '无权查看历史', data: null }, 403);

  const { results } = await c.env.DB.prepare(
    `SELECT id, resume_id AS resumeId, created_at AS createdAt
       FROM resume_versions WHERE resume_id = ?
      ORDER BY created_at DESC LIMIT ?`
  ).bind(resumeId, VERSION_KEEP_LIMIT).all();

  return c.json({ code: 0, message: 'success', data: results || [] });
});

app.post('/resumes/:id/restore/:historyId', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const historyId = c.req.param('historyId');

  const resume: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!resume || resume.user_id !== userId) return c.json({ code: 40301, message: '无权操作', data: null }, 403);

  const row: any = await c.env.DB.prepare(
    'SELECT title, template_id, content, theme_config FROM resume_versions WHERE id = ? AND resume_id = ?'
  ).bind(historyId, resumeId).first();
  if (!row) return c.json({ code: 40401, message: '历史版本不存在', data: null }, 404);

  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    'UPDATE resumes SET title = ?, template_id = ?, content = ?, theme_config = ?, updated_at = ? WHERE id = ?'
  ).bind(row.title || '未命名简历', row.template_id || 'classic', row.content, row.theme_config, now, resumeId).run();

  return c.json({ code: 0, message: '版本恢复成功', data: { updatedAt: now } });
});

// ======================= 2.16 投递管理 (Job Applications) =======================
//
// 一个看板：投了哪家、用哪份简历、进展到哪一步、下次什么时候跟进。
// 不做渠道对接、不发邮件 —— 那些需要第三方账号与回调，收益远小于复杂度。

/** 状态流转合法值由 schema 兜住；这里只做「用户是否拥有这条记录」的鉴权 */
async function loadOwnedApplication(c: any, userId: string, id: string) {
  const row: any = await c.env.DB.prepare(
    'SELECT * FROM job_applications WHERE id = ?'
  ).bind(id).first();
  if (!row) return { row: null, error: 'not-found' as const };
  if (row.user_id !== userId) return { row: null, error: 'forbidden' as const };
  return { row, error: null };
}

app.get('/jobs', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  // LEFT JOIN 简历取标题：简历被删后 resume_id 会被置空，标题自然为 null
  const { results } = await c.env.DB.prepare(
    `SELECT j.*, r.title AS resume_title
       FROM job_applications j
       LEFT JOIN resumes r ON r.id = j.resume_id
      WHERE j.user_id = ?
      ORDER BY j.updated_at DESC`
  ).bind(userId).all();

  const rows = (results || []).map(mapApplicationRow);
  const now = Math.floor(Date.now() / 1000);

  return c.json({
    code: 0,
    message: 'success',
    data: { items: rows, stats: computeApplicationStats(rows, now) }
  });
});

app.post('/jobs', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const raw = await readJsonBody(c);
  const checked = validate(createJobApplicationSchema, raw);
  if (!checked.ok) {
    return c.json({ code: 40001, message: issuesToMessage(checked.issues), data: null }, 400);
  }
  const body = checked.data as Record<string, any>;

  // 引用了不存在的简历会让 LEFT JOIN 取不到标题，也会在 D1 里留下悬空外键
  if (body.resumeId) {
    const owned: any = await c.env.DB.prepare(
      'SELECT id FROM resumes WHERE id = ? AND user_id = ?'
    ).bind(body.resumeId, userId).first();
    if (!owned) return c.json({ code: 40007, message: '关联的简历不存在', data: null }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const id = `job_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const status = body.status || 'applied';
  // 「已投递」且用户没填日期时，默认记成今天 —— 空着会让看板上的时间线断掉
  const appliedAt =
    body.appliedAt ?? (status === 'applied' ? now : null);

  await c.env.DB.prepare(
    `INSERT INTO job_applications
       (id, user_id, resume_id, company, position, location, channel, status,
        applied_at, next_action_at, next_action_note, salary_range, job_url, notes,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    userId,
    body.resumeId || null,
    body.company,
    body.position,
    body.location || null,
    body.channel || null,
    status,
    appliedAt,
    body.nextActionAt ?? null,
    body.nextActionNote || null,
    body.salaryRange || null,
    body.jobUrl || null,
    body.notes || null,
    now,
    now
  ).run();

  return c.json({
    code: 0,
    message: '已添加投递记录',
    data: { id, createdAt: now }
  });
});

app.patch('/jobs/:id', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const { row, error } = await loadOwnedApplication(c, userId, c.req.param('id'));
  if (error === 'not-found') return c.json({ code: 40401, message: '投递记录不存在', data: null }, 404);
  if (error === 'forbidden') return c.json({ code: 40301, message: '无权修改该记录', data: null }, 403);

  const raw = await readJsonBody(c);
  const checked = validate(jobApplicationSchema, raw);
  if (!checked.ok) {
    return c.json({ code: 40001, message: issuesToMessage(checked.issues), data: null }, 400);
  }
  const body = checked.data as Record<string, any>;

  if (body.resumeId) {
    const owned: any = await c.env.DB.prepare(
      'SELECT id FROM resumes WHERE id = ? AND user_id = ?'
    ).bind(body.resumeId, userId).first();
    if (!owned) return c.json({ code: 40007, message: '关联的简历不存在', data: null }, 400);
  }

  // 只更新请求里真的出现的字段：PATCH 的语义是「改这几项」，
  // 把缺失字段当 null 写入会把用户没碰过的内容清空
  const COLUMN_MAP: Record<string, string> = {
    resumeId: 'resume_id',
    company: 'company',
    position: 'position',
    location: 'location',
    channel: 'channel',
    status: 'status',
    appliedAt: 'applied_at',
    nextActionAt: 'next_action_at',
    nextActionNote: 'next_action_note',
    salaryRange: 'salary_range',
    jobUrl: 'job_url',
    notes: 'notes'
  };

  const sets: string[] = [];
  const values: any[] = [];
  for (const [key, column] of Object.entries(COLUMN_MAP)) {
    if (!(key in body)) continue;
    const value = body[key];
    sets.push(`${column} = ?`);
    // 字符串字段的空串统一存 NULL，避免出现「有值但是空」的两种状态
    values.push(typeof value === 'string' ? value.trim() || null : value ?? null);
  }

  if (!sets.length) {
    return c.json({ code: 40001, message: '没有需要更新的字段', data: null }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  sets.push('updated_at = ?');
  values.push(now, row.id);

  await c.env.DB.prepare(
    `UPDATE job_applications SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return c.json({ code: 0, message: '已更新', data: { id: row.id, updatedAt: now } });
});

app.delete('/jobs/:id', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const { row, error } = await loadOwnedApplication(c, userId, c.req.param('id'));
  if (error === 'not-found') return c.json({ code: 40401, message: '投递记录不存在', data: null }, 404);
  if (error === 'forbidden') return c.json({ code: 40301, message: '无权删除该记录', data: null }, 403);

  await c.env.DB.prepare('DELETE FROM job_applications WHERE id = ?').bind(row.id).run();
  return c.json({ code: 0, message: '已删除', data: { id: row.id } });
});

// ======================= 3. 对象存储上传 (Cloudflare R2) =======================

// 3.1 上传头像到 R2
// 3.1 上传头像到 R2 (严格白名单限制与路径隔离)
app.post('/upload/avatar', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || !(file instanceof File)) {
    return c.json({ code: 40003, message: '请上传有效图片文件', data: null }, 400);
  }

  // 大小限制 2MB
  if (file.size > 2 * 1024 * 1024) {
    return c.json({ code: 40004, message: '头像文件大小不得超过 2MB', data: null }, 400);
  }

  // MIME 白名单严格校验
  const ALLOWED_MIME: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };
  const ext = ALLOWED_MIME[file.type.toLowerCase()];
  if (!ext) {
    return c.json({ code: 40005, message: '仅支持 JPG、PNG 或 WebP 格式图片', data: null }, 400);
  }

  if (!c.env.BUCKET) {
    return c.json({ code: 50002, message: 'R2 存储未开通，请直接使用本地图片预览', data: null }, 500);
  }

  // 严格限定目录前缀在 open-resume/avatars/{userId}/ 命名空间下
  const randomSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  const key = `open-resume/avatars/${userId}/${Date.now()}_${randomSuffix}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  // 写入 R2 存储桶，严格设定合法 MIME
  await c.env.BUCKET.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type.toLowerCase()
    }
  });

  const avatarUrl = `/api/file/${key}`;

  return c.json({
    code: 0,
    message: '头像上传成功',
    data: { url: avatarUrl }
  });
});

// 3.2 读取 R2 存储文件代理 (防穿透与防 XSS 沙箱隔离)
app.get('/file/*', async (c) => {
  if (!c.env.BUCKET) return c.text('R2 Not Configured', 500);
  const key = c.req.path.replace('/api/file/', '');

  // 权限越界防御：严禁跨目录读取 common-bucket 内的其他对象
  if (!key.startsWith('open-resume/avatars/')) {
    return c.text('Forbidden: Access denied outside avatars scope', 403);
  }

  // 扩展名安全检查
  let safeMime = '';
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) safeMime = 'image/jpeg';
  else if (key.endsWith('.png')) safeMime = 'image/png';
  else if (key.endsWith('.webp')) safeMime = 'image/webp';
  else return c.text('Unsupported file type', 400);

  const object = await c.env.BUCKET.get(key);
  if (!object) return c.text('File Not Found', 404);

  const headers = new Headers();
  headers.set('Content-Type', safeMime);
  headers.set('X-Content-Type-Options', 'nosniff');
  // 注入安全沙箱策略，彻底防御 HTML 伪装与恶意脚本执行
  headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  if (object.httpEtag) headers.set('etag', object.httpEtag);

  return new Response(object.body, { headers });
});

// ======================= 4. 只读公开分享与 HR 访客追踪 =======================

// 4.1 获取公开只读简历数据 (严格校验 is_public 状态)
app.get('/share/:id', async (c) => {
  const resumeId = c.req.param('id');
  const resume: any = await c.env.DB.prepare(
    'SELECT id, title, template_id, content, theme_config, is_public, updated_at FROM resumes WHERE id = ?'
  ).bind(resumeId).first();

  if (!resume) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);

  // 未开启公开分享时禁止越权浏览
  if (resume.is_public !== 1) {
    return c.json({ code: 40301, message: '该简历暂未开启公开分享，请联系所有者开启', data: null }, 403);
  }

  return c.json({
    code: 0,
    message: 'success',
    data: {
      id: resume.id,
      title: resume.title,
      templateId: resume.template_id,
      content: safeParse<any>(resume.content, {}),
      themeConfig: safeParse<any>(resume.theme_config, {}),
      isPublic: resume.is_public,
      updatedAt: resume.updated_at
    }
  });
});

/**
 * 记录一次访问（旧版 `/share/:id/visit` 与新版 `/s/:token/visit` 共用）。
 *
 * 去重逻辑见 `functions/lib/visit.ts`：爬虫直接丢弃、同指纹 30 分钟内不重复、
 * 时长钳制到 0–1800s。这里只负责取上下文与落库。
 */
async function recordVisit(
  c: any,
  resumeId: string,
  body: { duration?: unknown; isDownloaded?: unknown }
) {
  const userAgent = c.req.header('User-Agent') || '';
  const isDownloaded = Boolean(body.isDownloaded);

  // Cloudflare 注入的真实客户端 IP；本地 dev 下可能为空
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || '';
  const country = (c.req.header('CF-IPCountry') || '').toUpperCase();
  const referer = c.req.header('Referer') || '';

  let recentCount = 0;
  try {
    const hash = await visitorHash(ip, userAgent, resumeId);
    const since = Math.floor(Date.now() / 1000) - VISIT_DEDUP_WINDOW_SECONDS;
    const row: any = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM resume_visits
        WHERE resume_id = ? AND visitor_hash = ? AND is_bot = 0 AND created_at >= ?`
    ).bind(resumeId, hash, since).first();
    recentCount = Number(row?.n) || 0;
  } catch {
    // 去重查询失败时宁可计数（少量重复好过整块数据丢失）
    recentCount = 0;
  }

  const decision = await decideVisit({
    resumeId,
    duration: body.duration,
    isDownloaded,
    context: { ip, userAgent, country, referer },
    recentCount
  });

  if (!decision.counted) {
    return { counted: false, reason: decision.reason };
  }

  const visitId = `v_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  await c.env.DB.prepare(
    `INSERT INTO resume_visits
       (id, resume_id, duration_seconds, is_downloaded, user_agent,
        visitor_hash, country, referer, is_bot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    visitId,
    resumeId,
    decision.duration,
    isDownloaded ? 1 : 0,
    userAgent.slice(0, 255) || 'Unknown',
    decision.visitorHash,
    decision.country,
    decision.referer,
    decision.isBot ? 1 : 0
  ).run();

  return { counted: true, visitId };
}

// 4.2 上报访客阅读足迹与行为心跳 (免登录，但必须为已公开简历)
app.post('/share/:id/visit', async (c) => {
  const resumeId = c.req.param('id');
  // 必须验证该简历是否存在且为公开状态
  const target: any = await c.env.DB.prepare('SELECT is_public FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!target || target.is_public !== 1) {
    return c.json({ code: 40301, message: '简历不存在或未公开分享', data: null }, 403);
  }

  const visitLimit = await checkRateLimit(c.env.DB, {
    action: 'visit',
    ip: clientIp(c.req.raw.headers)
  });
  if (!visitLimit.allowed) return rateLimitResponse(c, visitLimit.retryAfterSeconds);

  const body = await readJsonBody(c);
  const result = await recordVisit(c, resumeId, body);

  // 未计数不是错误：访客不会因为被去重而看到报错
  return c.json({
    code: 0,
    message: 'ok',
    data: { counted: result.counted, reason: result.reason ?? null, visitId: result.visitId ?? null }
  });
});

// ======================= 5. token 化分享链接（公开，无需登录） =======================

/**
 * 读取分享链接并返回简历载荷。
 *
 * 返回结构统一为 `{ link, resume, content }`，其中 `content` 已按
 * `mask_contact` 处理。密码校验交给调用方 —— 因为「取数据」与「校验密码」
 * 是两条不同的路由，共用同一段读取逻辑。
 */
interface SharePayloadError {
  error: { code: number; message: string; status: number };
}

interface SharePayloadOk {
  link: any;
  resume: {
    id: string;
    title: string;
    templateId: string;
    content: any;
    themeConfig: any;
    allowDownload: boolean;
    updatedAt: number;
  };
}

async function loadSharePayload(c: any, token: string): Promise<SharePayloadError | SharePayloadOk> {
  const link: any = await c.env.DB.prepare(
    `SELECT id, resume_id, token, password_hash, expires_at, allow_download, mask_contact,
            revoked_at, view_count
       FROM share_links
      WHERE token = ?`
  ).bind(token).first();

  if (!link) return { error: { code: 40401, message: shareStateMessage('revoked'), status: 404 } };

  const state = resolveShareLinkState(link);
  if (state === 'revoked' || state === 'expired') {
    return { error: { code: 41001, message: shareStateMessage(state), status: 410 } };
  }

  const resume: any = await c.env.DB.prepare(
    'SELECT id, title, template_id, content, theme_config, updated_at FROM resumes WHERE id = ?'
  ).bind(link.resume_id).first();

  if (!resume) return { error: { code: 40401, message: '该简历已被删除', status: 404 } };

  let content: any = safeParse<any>(resume.content, {});
  if (Number(link.mask_contact) === 1) content = maskResumeContent(content);

  const themeConfig: any = safeParse<any>(resume.theme_config, {});

  return {
    link,
    resume: {
      id: resume.id,
      title: resume.title,
      templateId: resume.template_id,
      content,
      themeConfig,
      allowDownload: Number(link.allow_download) === 1,
      updatedAt: resume.updated_at
    }
  };
}

// 5.1 通过 token 读取分享简历（需要密码时只返回提示，不返回数据）
app.get('/s/:token', async (c) => {
  const token = c.req.param('token');
  const payload = await loadSharePayload(c, token);
  if ('error' in payload) {
    const { code, message, status } = payload.error;
    return c.json({ code, message, data: null }, status as any);
  }

  const { link, resume } = payload;
  if (link.password_hash) {
    // 200 + 明确标记，让分享页能直接切到密码输入态，而不是当成错误
    return c.json({
      code: 0,
      message: '该分享链接需要访问密码',
      data: { requiresPassword: true, title: resume.title }
    });
  }

  await c.env.DB.prepare(
    'UPDATE share_links SET view_count = view_count + 1, last_viewed_at = ? WHERE id = ?'
  ).bind(Math.floor(Date.now() / 1000), link.id).run().catch(() => {});

  return c.json({ code: 0, message: 'success', data: { requiresPassword: false, ...resume } });
});

// 5.2 提交访问密码换取简历数据
app.post('/s/:token/unlock', async (c) => {
  const token = c.req.param('token');
  const payload = await loadSharePayload(c, token);
  if ('error' in payload) {
    const { code, message, status } = payload.error;
    return c.json({ code, message, data: null }, status as any);
  }

  // 4 位密码的空间只有 1 万，不限流等于允许离线式爆破
  const unlockLimit = await checkRateLimit(c.env.DB, {
    action: 'unlock',
    ip: clientIp(c.req.raw.headers)
  });
  if (!unlockLimit.allowed) return rateLimitResponse(c, unlockLimit.retryAfterSeconds);

  const { link, resume } = payload;
  const body = await readJsonBody(c);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!link.password_hash) {
    return c.json({ code: 0, message: 'success', data: { requiresPassword: false, ...resume } });
  }
  if (!password) {
    return c.json({ code: 40001, message: '请输入访问密码', data: null }, 400);
  }

  const { isValid } = await verifyPassword(password, link.password_hash);
  if (!isValid) {
    return c.json({ code: 40102, message: '访问密码不正确', data: null }, 401);
  }

  await c.env.DB.prepare(
    'UPDATE share_links SET view_count = view_count + 1, last_viewed_at = ? WHERE id = ?'
  ).bind(Math.floor(Date.now() / 1000), link.id).run().catch(() => {});

  return c.json({ code: 0, message: 'success', data: { requiresPassword: false, ...resume } });
});

// 5.3 上报 token 分享链接的访问（与 /share/:id/visit 语义一致）
app.post('/s/:token/visit', async (c) => {
  const token = c.req.param('token');
  const link: any = await c.env.DB.prepare(
    'SELECT id, resume_id, revoked_at, expires_at FROM share_links WHERE token = ?'
  ).bind(token).first();

  if (!link || resolveShareLinkState(link) !== 'ok') {
    return c.json({ code: 40301, message: '分享链接已失效', data: null }, 403);
  }

  const visitLimit = await checkRateLimit(c.env.DB, {
    action: 'visit',
    ip: clientIp(c.req.raw.headers)
  });
  if (!visitLimit.allowed) return rateLimitResponse(c, visitLimit.retryAfterSeconds);

  const body = await readJsonBody(c);
  const result = await recordVisit(c, link.resume_id, body);

  return c.json({
    code: 0,
    message: 'ok',
    data: { counted: result.counted, reason: result.reason ?? null, visitId: result.visitId ?? null }
  });
});


// ======================= 6. 可观测性上报（公开，无需登录） =======================

/**
 * 接收前端的错误 / Web Vitals / 业务埋点。
 *
 * 三件事刻意没做：
 * 1. **不返回任何数据**：这是个漏斗，不是查询接口。运营数据从 D1 里直接查。
 * 2. **不做鉴权**：未登录用户的报错同样有价值（首页白屏比登录后保存失败更严重），
 *    代价是任何人都能往聚合表里加计数 —— 用限流 + 名称白名单把损失压到「多几个数字」。
 * 3. **不因参数不合法返回 4xx**：埋点客户端不该处理错误分支，
 *    非法事件直接丢弃，始终返回 204。
 */
app.post('/telemetry', async (c) => {
  const ip = clientIp(c.req.raw.headers);
  const limit = await checkRateLimit(c.env.DB, { action: 'telemetry', ip });
  if (!limit.allowed) return rateLimitResponse(c, limit.retryAfterSeconds);

  const body = await readJsonBody(c);
  await recordTelemetry(c.env.DB, body.events);

  return c.body(null, 204);
});


// ======================= 7. AI 改写（自带 Key，公开但限流） =======================

/**
 * 由本站转发到用户自己配置的模型服务商。
 *
 * 三条边界，写在这里也写在隐私政策里：
 * 1. **API Key 不落库**：只存在于这一次请求的内存里，用完即丢。
 *    日志中间件只记方法/路径/状态/耗时，不记请求体（这也正是它从不记 body 的原因）。
 * 2. **原文不落库**：简历正文同样只在这次请求中出现，不写任何表、不进任何统计。
 * 3. **不校验登录**：改简历的游客同样需要这个功能，而他们没有 token。
 *    代价是接口对所有人开放，用限流 + 自带 Key 把损失压到「他自己的账单」。
 */
app.post('/ai/rewrite', async (c) => {
  const ip = clientIp(c.req.raw.headers);
  const limit = await checkRateLimit(c.env.DB, { action: 'ai', ip });
  if (!limit.allowed) return rateLimitResponse(c, limit.retryAfterSeconds);

  const checked = validateRewriteRequest(await readJsonBody(c));
  if (!checked.ok) {
    // 失败同样记一次埋点：接入失败率是判断「预设地址是否已经过期」的唯一信号
    trackServer(c, 'ai.rewrite.fail');
    return c.json({ code: checked.error.code, message: checked.error.message, data: null }, checked.error.status);
  }

  const { apiKey, baseUrl, model, style, target, text, instruction, context } = checked.value;
  const result = await callChatCompletion({
    baseUrl,
    apiKey,
    model,
    messages: buildRewriteMessages({ text, style, target, instruction, context })
  });

  if (!result.ok) {
    trackServer(c, 'ai.rewrite.fail');
    return c.json({ code: result.error.code, message: result.error.message, data: null }, result.error.status);
  }

  // 只记成功次数与字数区间，不记内容、不记模型名（那是用户的选择，属于他的隐私）
  trackServer(c, 'ai.rewrite.ok');
  logStructured('info', {
    event: 'ai.rewrite',
    provider: checked.value.providerId,
    style,
    target,
    inputChars: text.length,
    outputChars: result.text.length
  });

  return c.json({
    code: 0,
    message: 'ok',
    data: {
      text: result.text,
      /** 供前端显示「原文 → 改写」的字数变化 */
      inputChars: text.length,
      outputChars: result.text.length
    }
  });
});

/**
 * 拉取厂商的模型清单，用于在设置里挑选。
 *
 * 与改写分开成一个端点，而不是塞进 `/ai/rewrite` 加个 action 字段：
 * 两者的失败语义完全不同（一个是「要改写的内容有问题」，一个是「设置填错了」），
 * 混在一起会让前端的错误分支变成一锅粥。
 */
app.post('/ai/models', async (c) => {
  const ip = clientIp(c.req.raw.headers);
  const limit = await checkRateLimit(c.env.DB, { action: 'ai', ip });
  if (!limit.allowed) return rateLimitResponse(c, limit.retryAfterSeconds);

  const checked = validateModelListRequest(await readJsonBody(c));
  if (!checked.ok) {
    return c.json({ code: checked.error.code, message: checked.error.message, data: null }, checked.error.status);
  }

  const result = await fetchModelList(checked.value.baseUrl, checked.value.apiKey);
  if (!result.ok) {
    return c.json({ code: result.error.code, message: result.error.message, data: null }, result.error.status);
  }

  return c.json({ code: 0, message: 'ok', data: { models: result.models } });
});

// 导出 Cloudflare Pages Functions 处理入口
export const onRequest = handle(app);

