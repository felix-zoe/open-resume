/**
 * 统一 HTTP 客户端。
 *
 * 解决的问题：
 * - 每个调用点各自拼 `Authorization`，漏写一处就是 401；
 * - `fetch` 没有超时，弱网下 UI 会一直转圈；
 * - 后端返回非 JSON（网关错误页）时 `.json()` 直接抛错，错误信息丢失；
 * - 401 没有统一处理，用户停在“已登录”的假象里。
 */

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  /** 后端 `{ code, message, data }` 中的 data；非 0 或解析失败时为 null */
  data: T | null;
  code: number;
  message: string;
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  /** JSON 请求体（自动序列化并设置 Content-Type） */
  body?: unknown;
  /** 超时毫秒数，默认 10s */
  timeout?: number;
  /** 是否自动附加 Bearer Token，默认 true */
  auth?: boolean;
}

type UnauthorizedHandler = (redirect: string) => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/** 由 main.ts 注册，避免 http 层反向依赖 router / store */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

const TOKEN_KEY = 'open_resume_token';

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function currentPath(): string {
  return typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search;
}

// 并发请求可能同时收到 401：只处理第一次，避免重复登出/重复跳转
let lastUnauthorizedAt = 0;

function notifyUnauthorized(status: number, path: string) {
  // 登录/注册接口的 401 是“密码错误”，不能触发登出
  if (path.startsWith('/api/auth/')) return;
  if (status !== 401) return;
  // 已经在登录页时忽略，避免死循环
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/login')) return;
  const now = Date.now();
  if (now - lastUnauthorizedAt < 2000) return;
  lastUnauthorizedAt = now;
  unauthorizedHandler?.(currentPath());
}

/** 仅测试使用：重置 401 去重窗口 */
export function __resetUnauthorizedState() {
  lastUnauthorizedAt = 0;
}

/**
 * 发起请求并归一化响应。
 * 不抛异常：网络错误 / 超时 / 非 JSON 都以 `ok: false` 返回，调用方只看 `ok`。
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<ApiResult<T>> {
  const { body, timeout = 10_000, auth = true, headers, ...rest } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const finalHeaders = new Headers(headers);
  let payload: BodyInit | undefined;

  if (body instanceof FormData) {
    // 交给浏览器设置 multipart 边界
    payload = body;
  } else if (body !== undefined) {
    finalHeaders.set('Content-Type', 'application/json');
    payload = JSON.stringify(body);
  }

  if (auth) {
    const token = getToken();
    if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
  }

  try {
    const res = await fetch(path, {
      ...rest,
      headers: finalHeaders,
      body: payload,
      signal: controller.signal
    });

    const json: any = await res.json().catch(() => null);
    const code = typeof json?.code === 'number' ? json.code : res.ok ? 0 : res.status;
    const message = typeof json?.message === 'string' ? json.message : res.statusText || '请求失败';
    const ok = res.ok && (json === null ? true : json.code === 0);

    if (res.status === 401) notifyUnauthorized(res.status, path);

    return {
      ok,
      status: res.status,
      data: (json?.data ?? null) as T | null,
      code,
      message
    };
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      data: null,
      code: aborted ? -1 : -2,
      message: aborted ? '请求超时，请检查网络后重试' : '网络连接失败，请稍后重试'
    };
  } finally {
    clearTimeout(timer);
  }
}
