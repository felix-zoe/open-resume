/**
 * 请求侧安全基元：JSON 解析、体积上限、客户端 IP、CORS 源判定。
 *
 * 抽成纯函数是为了让它们能被 Vitest 直接覆盖 —— 这些逻辑一旦出错，
 * 表现是「某类请求静默失败」或「跨站可读」，很难在联调里发现。
 */

/** 单份简历正文上限 512KB。正常简历（含 base64 头像）约 100–200KB。 */
export const MAX_RESUME_BYTES = 512 * 1024;

export interface ParseResult<T> {
  value: T;
  /** 原始文本非空但解析失败 —— 说明库里存的是脏数据，不是「空简历」 */
  corrupt: boolean;
}

/**
 * 解析数据库里存的 JSON 字符串。
 *
 * 与 `JSON.parse` 的区别：脏数据不再抛错，而是把 `corrupt` 标出来，
 * 由调用方决定「降级为空」还是「返回 50001 让用户从版本历史恢复」。
 */
export function parseStoredJson<T>(raw: unknown, fallback: T): ParseResult<T> {
  if (raw === null || raw === undefined) return { value: fallback, corrupt: false };
  if (typeof raw === 'object') return { value: raw as T, corrupt: false };
  if (typeof raw !== 'string') return { value: fallback, corrupt: true };
  if (!raw.trim()) return { value: fallback, corrupt: false };
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return { value: fallback, corrupt: false };
    return { value: parsed as T, corrupt: false };
  } catch {
    return { value: fallback, corrupt: true };
  }
}

/** 只需要值、不关心是否损坏的场合（如 theme_config） */
export function safeParse<T>(raw: unknown, fallback: T): T {
  return parseStoredJson(raw, fallback).value;
}

/** UTF-8 字节数。`String.length` 数的是 UTF-16 码元，中文会算少一半。 */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/**
 * 取客户端 IP。
 *
 * 生产环境 Cloudflare 必定注入 `CF-Connecting-IP`，且该头不可被客户端伪造；
 * `X-Forwarded-For` 只在本地 dev（无 CF）时兜底 —— 它可伪造，不能单独用于安全判定。
 */
export function clientIp(headers: { get(name: string): string | null }): string {
  const direct = headers.get('CF-Connecting-IP');
  if (direct && direct.trim()) return direct.trim();

  const forwarded = headers.get('X-Forwarded-For');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }

  return 'unknown';
}

/**
 * 判定跨域请求是否放行。
 *
 * 同源请求不带 `Origin`，返回 undefined（不加 CORS 头，也不影响正常访问）；
 * 未配置 `APP_ORIGIN` 时**不放行任何跨域来源** —— 默认拒绝比默认全开安全。
 */
export function resolveAllowedOrigin(
  origin: string | undefined | null,
  appOrigin: string | undefined | null
): string | undefined {
  if (!origin) return undefined;
  const allowed = String(appOrigin || '')
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (!allowed.length) return undefined;
  const normalized = origin.trim().replace(/\/$/, '');
  return allowed.includes(normalized) ? origin : undefined;
}
