import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { Env } from '../types';

const app = new Hono<{ Bindings: Env }>().basePath('/api');

// 全局 CORS 中间件
app.use('*', cors());

// 工具：密码哈希 (基于 Web Crypto API SHA-256)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'open_resume_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 鉴权中间件辅助函数
async function getAuthUserId(c: any): Promise<string | null> {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    const payload = await verify(token, c.env.JWT_SECRET || 'open-resume-dev-secret-key-change-in-prod', 'HS256');
    return (payload as any).userId || null;
  } catch {
    return null;
  }
}

// ======================= 1. 认证模块 (Auth) =======================

// 1.1 用户注册
app.post('/auth/register', async (c) => {
  const { email, password, nickname } = await c.req.json();
  if (!email || !password || password.length < 6) {
    return c.json({ code: 40001, message: '邮箱或密码不符合规范', data: null }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return c.json({ code: 40002, message: '该邮箱已被注册', data: null }, 400);
  }

  const userId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const passwordHash = await hashPassword(password);
  const userNick = nickname || email.split('@')[0];

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, password_hash, nickname) VALUES (?, ?, ?, ?)'
  ).bind(userId, email, passwordHash, userNick).run();

  const token = await sign(
    { userId, email, exp: Math.floor(Date.now() / 1000) + 7 * 86400 },
    c.env.JWT_SECRET || 'open-resume-dev-secret-key-change-in-prod'
  );

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

  const passwordHash = await hashPassword(password);
  const user = await c.env.DB.prepare(
    'SELECT id, email, nickname, avatar_url FROM users WHERE email = ? AND password_hash = ?'
  ).bind(email, passwordHash).first();

  if (!user) {
    return c.json({ code: 40103, message: '账号或密码错误', data: null }, 401);
  }

  const token = await sign(
    { userId: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 7 * 86400 },
    c.env.JWT_SECRET || 'open-resume-dev-secret-key-change-in-prod'
  );

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

  const existing: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!existing) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (existing.user_id !== userId) return c.json({ code: 40301, message: '无权修改该简历', data: null }, 403);

  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    'UPDATE resumes SET title = ?, template_id = ?, content = ?, theme_config = ?, updated_at = ? WHERE id = ?'
  ).bind(
    body.title || '未命名简历',
    body.templateId || 'classic',
    JSON.stringify(body.content || {}),
    JSON.stringify(body.themeConfig || {}),
    now,
    resumeId
  ).run();

  return c.json({
    code: 0,
    message: '保存成功',
    data: { id: resumeId, updatedAt: now }
  });
});

// 2.5 删除简历
app.delete('/resumes/:id', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const resumeId = c.req.param('id');
  const existing: any = await c.env.DB.prepare('SELECT user_id FROM resumes WHERE id = ?').bind(resumeId).first();
  if (!existing) return c.json({ code: 40401, message: '简历不存在', data: null }, 404);
  if (existing.user_id !== userId) return c.json({ code: 40301, message: '无权删除该简历', data: null }, 403);

  await c.env.DB.prepare('DELETE FROM resumes WHERE id = ?').bind(resumeId).run();
  return c.json({ code: 0, message: '删除成功', data: { id: resumeId } });
});

// ======================= 3. 对象存储上传 (Cloudflare R2) =======================

// 3.1 上传头像到 R2
app.post('/upload/avatar', async (c) => {
  const userId = await getAuthUserId(c);
  if (!userId) return c.json({ code: 40101, message: '请先登录', data: null }, 401);

  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || !(file instanceof File)) {
    return c.json({ code: 40003, message: '请上传有效图片文件', data: null }, 400);
  }

  const key = `avatars/${userId}_${Date.now()}.webp`;
  const arrayBuffer = await file.arrayBuffer();

  // 写入 R2 存储桶
  await c.env.BUCKET.put(key, arrayBuffer, {
    httpMetadata: {
      contentType: file.type || 'image/webp'
    }
  });

  // 返回图片访问链接 (如果配置了绑定域名或 r2.dev)
  const avatarUrl = `/api/file/${key}`;

  return c.json({
    code: 0,
    message: '头像上传成功',
    data: { url: avatarUrl }
  });
});

// 3.2 读取 R2 存储文件代理
app.get('/file/*', async (c) => {
  const key = c.req.path.replace('/api/file/', '');
  const object = await c.env.BUCKET.get(key);

  if (!object) return c.text('File Not Found', 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000');

  return new Response(object.body, { headers });
});

// 导出 Cloudflare Pages Functions 处理入口
export const onRequest = handle(app);
