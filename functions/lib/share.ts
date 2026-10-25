/**
 * 分享链接相关的纯函数。
 *
 * 抽出来的原因与 security.ts 一致：这些逻辑是「不可回退的安全承诺」
 * （联系方式脱敏、token 不可预测），必须能被 Vitest 直接覆盖，
 * 而不是埋在路由处理器里靠人工点页面验证。
 */

/** 分享链接有效期枚举（秒），`null` 表示永久 */
export const SHARE_TTL_OPTIONS = {
  '7d': 7 * 24 * 3600,
  '30d': 30 * 24 * 3600,
  permanent: null
} as const;

export type ShareTtl = keyof typeof SHARE_TTL_OPTIONS;

/** 计算过期时间戳（秒）；永久返回 null */
export function expiresAtFrom(ttl: ShareTtl, nowSeconds = Math.floor(Date.now() / 1000)): number | null {
  const seconds = SHARE_TTL_OPTIONS[ttl];
  return seconds === null ? null : nowSeconds + seconds;
}

/** 32 字节随机 token，base32 风格字符集，去掉易混淆的 0/O/1/I */
const TOKEN_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

/**
 * 生成分享 token。
 *
 * 长度 22 字符 × log2(31) ≈ 109 bit，远超暴力枚举可行范围；
 * 使用 `crypto.getRandomValues` 而不是 Math.random —— 后者在 Workers 里
 * 可预测，会让「私密链接」变成可猜测的 id。
 */
export function generateShareToken(length = 22): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

/** 手机号脱敏：保留前 3 后 4，中间固定 4 个星号 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // 短号（如分机 8888）没有可保留的中间段，整段打码
  if (digits.length < 8) return '*'.repeat(digits.length);
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

/** 邮箱脱敏：本地部分保留首字符，域名保留（域名本身是公开信息） */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return email ? '***' : '';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 1) return `***${domain}`;
  return `${local[0]}***${domain}`;
}

/**
 * 对简历内容做联系方式脱敏。
 *
 * 只改 `profile.phone` / `profile.email`，其余字段原样返回。
 * 刻意不做深拷贝替换：调用方传入的是解析后的新对象，
 * 这里的语义是「返回脱敏副本」，不要在原地改。
 */
export function maskResumeContent<T extends { profile?: Record<string, any> }>(content: T): T {
  if (!content || typeof content !== 'object' || !content.profile) return content;
  const profile = { ...content.profile };
  if (typeof profile.phone === 'string' && profile.phone) profile.phone = maskPhone(profile.phone);
  if (typeof profile.email === 'string' && profile.email) profile.email = maskEmail(profile.email);
  return { ...content, profile } as T;
}

export interface ShareLinkRow {
  id: string;
  resume_id: string;
  token: string;
  password_hash?: string | null;
  expires_at?: number | null;
  allow_download?: number | null;
  mask_contact?: number | null;
  revoked_at?: number | null;
}

export type ShareLinkState = 'ok' | 'revoked' | 'expired' | 'needs-password';

/** 判定分享链接当前状态，供接口与分享页共用同一套语义 */
export function resolveShareLinkState(
  link: ShareLinkRow | null | undefined,
  nowSeconds = Math.floor(Date.now() / 1000)
): ShareLinkState {
  if (!link) return 'revoked';
  if (link.revoked_at) return 'revoked';
  if (typeof link.expires_at === 'number' && link.expires_at > 0 && link.expires_at <= nowSeconds) {
    return 'expired';
  }
  if (link.password_hash) return 'needs-password';
  return 'ok';
}

/** 把状态映射成给访客看的文案（不泄露「简历存在但被撤销」以外的信息） */
export function shareStateMessage(state: ShareLinkState): string {
  switch (state) {
    case 'expired':
      return '该分享链接已过期，请联系求职者重新生成';
    case 'revoked':
      return '该分享链接已失效，请联系求职者重新生成';
    case 'needs-password':
      return '该分享链接需要访问密码';
    default:
      return '';
  }
}
