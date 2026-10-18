import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { Env } from '../types';
import {
  hashPasswordPBKDF2,
  verifyPassword,
  requireJwtSecret,
  isMissingSecretError
} from '../lib/security';

const app = new Hono<{ Bindings: Env }>().basePath('/api');

// 全局 CORS 中间件
app.use('*', cors());

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

// ======================= 1. 认证模块 (Auth) =======================

// 1.1 用户注册
app.post('/auth/register', async (c) => {
  const { email, password, nickname } = await c.req.json();
  if (!email || !password || password.length < 6) {
    return c.json({ code: 40001, message: '邮箱或密码不符合规范（密码至少6位）', data: null }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return c.json({ code: 40002, message: '该邮箱已被注册', data: null }, 400);
  }

  const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const passwordHash = await hashPasswordPBKDF2(password);
  const userNick = nickname || email.split('@')[0];

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
  const { email, password } = await c.req.json();
  if (!email || !password) {
    return c.json({ code: 40001, message: '邮箱与密码不能为空', data: null }, 400);
  }

  const user: any = await c.env.DB.prepare(
    'SELECT id, email, nickname, avatar_url, password_hash FROM users WHERE email = ?'
  ).bind(email).first();

  if (!user) {
    return c.json({ code: 40103, message: '账号或密码错误', data: null }, 401);
  }

  const { isValid, needsUpgrade } = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return c.json({ code: 40103, message: '账号或密码错误', data: null }, 401);
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

  const user = await c.env.DB.prepare(
    'SELECT id, email, nickname, avatar_url, created_at FROM users WHERE id = ?'
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
      createdAt: user.created_at
    }
  });
});

// ======================= 2. 简历管理模块 (Resumes) =======================

// 2.1 获取我的简历列表 (轻量元数据)
app.get('/resumes', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const { results } = await c.env.DB.prepare(
    'SELECT id, title, template_id as templateId, is_public as isPublic, created_at as createdAt, updated_at as updatedAt FROM resumes WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(userId).all();

  return c.json({ code: 0, message: 'success', data: results || [] });
});

// 2.2 创建一份新简历
app.post('/resumes', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const body = await c.req.json().catch(() => ({}));
  const resumeId = `res_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const title = body.title || '未命名求职简历';
  const templateId = body.templateId || 'classic';
  const content = JSON.stringify(body.content || {});
  const themeConfig = JSON.stringify(body.themeConfig || {});

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

  return c.json({
    code: 0,
    message: 'success',
    data: {
      id: resume.id,
      userId: resume.user_id,
      title: resume.title,
      templateId: resume.template_id,
      content: JSON.parse(resume.content || '{}'),
      themeConfig: JSON.parse(resume.theme_config || '{}'),
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
  const body = await c.req.json();

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

  // 自动为重要保存留存一份快照历史 (若距上次快照超过 3 分钟)
  try {
    const lastSnap: any = await c.env.DB.prepare(
      'SELECT created_at FROM resume_history WHERE resume_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(resumeId).first();
    if (!lastSnap || (now - lastSnap.created_at) > 180) {
      const historyId = `snap_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
      await c.env.DB.prepare(
        'INSERT INTO resume_history (id, resume_id, snapshot, created_at) VALUES (?, ?, ?, ?)'
      ).bind(historyId, resumeId, JSON.stringify({
        title: body.title || '未命名简历',
        templateId: body.templateId || 'classic',
        content: body.content || {},
        themeConfig: body.themeConfig || {}
      }), now).run();
    }
  } catch (err) {
    console.error('自动保存快照失败:', err);
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
  const body = await c.req.json().catch(() => ({}));
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
  const body = await c.req.json().catch(() => ({}));
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

// 2.7 删除简历 (显式级联清理关联历史与访问记录)
app.delete('/resumes/:id', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const existing: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!existing) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (existing.user_id !== userId) return c.json({ code: 40301, message: '无权删除该简历', data: null }, 403);

  // 显式清理关联表，确保 D1 无外键级联模式下无孤儿行残留
  await c.env.DB.prepare('DELETE FROM resume_history WHERE resume_id = ?').bind(resumeId).run().catch(() => {});
  await c.env.DB.prepare('DELETE FROM resume_visits WHERE resume_id = ?').bind(resumeId).run().catch(() => {});
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

  const stats: any = await c.env.DB.prepare(
    'SELECT COUNT(*) as totalViews, AVG(duration_seconds) as avgDuration, SUM(is_downloaded) as totalDownloads FROM resume_visits WHERE resume_id = ?'
  ).bind(resumeId).first();

  const { results: recent } = await c.env.DB.prepare(
    'SELECT id, duration_seconds as duration, is_downloaded as isDownloaded, created_at as createdAt FROM resume_visits WHERE resume_id = ? ORDER BY created_at DESC LIMIT 10'
  ).bind(resumeId).all();

  return c.json({
    code: 0,
    message: 'success',
    data: {
      totalViews: stats?.totalViews || 0,
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
            COALESCE(AVG(v.duration_seconds), 0) AS avgDuration,
            COALESCE(SUM(v.is_downloaded), 0) AS totalDownloads
       FROM resumes r
       LEFT JOIN resume_visits v ON v.resume_id = r.id
      WHERE r.user_id = ?
      GROUP BY r.id`
  ).bind(userId).all();

  return c.json({
    code: 0,
    message: 'success',
    data: (results || []).map((row: any) => ({
      resumeId: row.resumeId,
      totalViews: Number(row.totalViews) || 0,
      avgDuration: Math.round(Number(row.avgDuration) || 0),
      totalDownloads: Number(row.totalDownloads) || 0
    }))
  });
});

// 2.10 获取历史版本时光机列表
app.get('/resumes/:id/history', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const resume: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!resume || resume.user_id !== userId) return c.json({ code: 40301, message: '无权查看历史', data: null }, 403);

  const { results } = await c.env.DB.prepare(
    'SELECT id, resume_id as resumeId, created_at as createdAt FROM resume_history WHERE resume_id = ? ORDER BY created_at DESC LIMIT 15'
  ).bind(resumeId).all();

  return c.json({ code: 0, message: 'success', data: results || [] });
});

// 2.11 恢复指定的历史版本快照
app.post('/resumes/:id/restore/:historyId', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const historyId = c.req.param('historyId');

  const resume: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!resume || resume.user_id !== userId) return c.json({ code: 40301, message: '无权操作', data: null }, 403);

  const hist: any = await c.env.DB.prepare('SELECT snapshot FROM resume_history WHERE id = ? AND resume_id = ?').bind(historyId, resumeId).first();
  if (!hist) return c.json({ code: 40401, message: '历史版本不存在', data: null }, 404);

  const data = JSON.parse(hist.snapshot);
  const now = Math.floor(Date.now() / 1000);

  await c.env.DB.prepare(
    'UPDATE resumes SET title = ?, template_id = ?, content = ?, theme_config = ?, updated_at = ? WHERE id = ?'
  ).bind(
    data.title || '未命名简历',
    data.templateId || 'classic',
    JSON.stringify(data.content || {}),
    JSON.stringify(data.themeConfig || {}),
    now,
    resumeId
  ).run();

  return c.json({ code: 0, message: '版本恢复成功', data: { updatedAt: now } });
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
      content: JSON.parse(resume.content || '{}'),
      themeConfig: JSON.parse(resume.theme_config || '{}'),
      isPublic: resume.is_public,
      updatedAt: resume.updated_at
    }
  });
});

// 4.2 上报访客阅读足迹与行为心跳 (免登录，但必须为已公开简历)
app.post('/share/:id/visit', async (c) => {
  const resumeId = c.req.param('id');
  // 必须验证该简历是否存在且为公开状态
  const target: any = await c.env.DB.prepare('SELECT is_public FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!target || target.is_public !== 1) {
    return c.json({ code: 40301, message: '简历不存在或未公开分享', data: null }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  let duration = Number(body.duration || 0);
  if (isNaN(duration) || duration < 0) duration = 0;
  if (duration > 3600) duration = 3600; // 限制单次合理最大时长防刷

  const isDownloaded = body.isDownloaded ? 1 : 0;
  const userAgent = (c.req.header('User-Agent') || 'Unknown').slice(0, 255);
  const visitId = `v_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  await c.env.DB.prepare(
    'INSERT INTO resume_visits (id, resume_id, duration_seconds, is_downloaded, user_agent) VALUES (?, ?, ?, ?, ?)'
  ).bind(visitId, resumeId, duration, isDownloaded, userAgent).run();

  return c.json({ code: 0, message: 'ok', data: { visitId } });
});


// 导出 Cloudflare Pages Functions 处理入口
export const onRequest = handle(app);

