/**
 * 账号字段的归一化与校验。
 *
 * 归一化必须发生在**查询之前**：旧实现直接拿原始 email 去 `SELECT ... WHERE email = ?`，
 * 用户用 `Alice@Example.com` 注册、再用 `alice@example.com` 登录就会查不到人，
 * 反过来同一邮箱还能注册出两个账号。
 */

export const MAX_EMAIL_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;
export const NICKNAME_MAX_LENGTH = 20;

/** 只做「像不像邮箱」的粗筛，真正的可达性校验要靠邮件验证（M5） */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH);
}

/** 返回错误文案；合法时返回 null（便于路由层 `if (msg) return ...`） */
export function checkEmail(email: string): string | null {
  if (!email) return '请输入邮箱';
  if (email.length > MAX_EMAIL_LENGTH) return `邮箱长度不能超过 ${MAX_EMAIL_LENGTH} 个字符`;
  if (!EMAIL_PATTERN.test(email)) return '邮箱格式不正确';
  return null;
}

export function checkPassword(password: unknown): string | null {
  if (typeof password !== 'string' || !password) return '请输入密码';
  if (password.length < PASSWORD_MIN_LENGTH) return `密码至少 ${PASSWORD_MIN_LENGTH} 位`;
  if (password.length > PASSWORD_MAX_LENGTH) return `密码不能超过 ${PASSWORD_MAX_LENGTH} 位`;
  return null;
}

/** 昵称留空时退回邮箱前缀，避免出现「未命名用户」 */
export function normalizeNickname(raw: unknown, email: string): string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim().slice(0, NICKNAME_MAX_LENGTH);
    if (trimmed) return trimmed;
  }
  return email.split('@')[0] || '用户';
}
