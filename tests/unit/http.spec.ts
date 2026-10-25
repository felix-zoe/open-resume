import { describe, expect, it, vi, beforeEach } from 'vitest';
import { apiFetch, setUnauthorizedHandler, __resetUnauthorizedState } from '../../src/utils/http';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetUnauthorizedState();
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
  });

  it('自动附加 Bearer Token', async () => {
    localStorage.setItem('open_resume_token', 'tok_1');
    const fetchMock = vi.fn(async () => jsonResponse({ code: 0, data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch('/api/resumes');

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ ok: true });
    const headers = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer tok_1');
  });

  it('auth: false 时不附加 Token', async () => {
    localStorage.setItem('open_resume_token', 'tok_1');
    const fetchMock = vi.fn(async () => jsonResponse({ code: 0, data: null }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/share/x', { auth: false });

    const headers = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Headers;
    expect(headers.get('Authorization')).toBeNull();
  });

  it('JSON body 自动序列化并设置 Content-Type', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ code: 0, data: null }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/resumes', { method: 'PUT', body: { title: 't' } });

    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.body).toBe('{"title":"t"}');
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json');
  });

  it('业务码非 0 时 ok 为 false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: 40002, message: '邮箱已注册', data: null })));

    const result = await apiFetch('/api/auth/register', { method: 'POST', body: {} });

    expect(result.ok).toBe(false);
    expect(result.code).toBe(40002);
    expect(result.message).toBe('邮箱已注册');
  });

  it('非 JSON 响应不抛错', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>gateway error</html>', { status: 502 }))
    );

    const result = await apiFetch('/api/resumes');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(502);
  });

  it('网络异常归一化为失败结果', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }));

    const result = await apiFetch('/api/resumes');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.message).toContain('网络');
  });

  it('超时返回可读错误', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    }));

    const result = await apiFetch('/api/resumes', { timeout: 10 });

    expect(result.ok).toBe(false);
    expect(result.code).toBe(-1);
    expect(result.message).toContain('超时');
  });
});

describe('401 全局处理', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetUnauthorizedState();
    setUnauthorizedHandler(null);
    vi.unstubAllGlobals();
  });

  it('受保护接口 401 触发一次登出回调', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: 40101, message: '未授权' }, 401)));

    await apiFetch('/api/resumes');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('并发 401 只触发一次', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: 40101 }, 401)));

    await Promise.all([apiFetch('/api/resumes'), apiFetch('/api/resumes/x'), apiFetch('/api/analytics')]);

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('登录接口 401 不触发登出', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: 40103, message: '账号或密码错误' }, 401)));

    const result = await apiFetch('/api/auth/login', { method: 'POST', body: {}, auth: false });

    expect(result.ok).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('分享密码错误 401 不触发登出（访客本就没登录）', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: 40102, message: '访问密码不正确' }, 401)));

    const result = await apiFetch('/api/s/tok123/unlock', {
      method: 'POST',
      body: { password: 'wrong' },
      auth: false
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe('访问密码不正确');
    expect(handler).not.toHaveBeenCalled();
  });

  it('旧版 /api/share 的 401 同样不触发登出', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ code: 40102 }, 401)));

    await apiFetch('/api/share/res_1/visit', { method: 'POST', body: {}, auth: false });

    expect(handler).not.toHaveBeenCalled();
  });
});
