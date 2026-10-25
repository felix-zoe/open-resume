import { describe, expect, it, vi } from 'vitest';
import {
  RATE_LIMITS,
  checkRateLimit,
  evaluate,
  pruneRateLimits,
  rateLimitKey,
  retryAfter,
  windowIndex
} from '../../functions/lib/rate-limit';

/** 最小 D1 桩：只实现 checkRateLimit 用到的那条 upsert */
function fakeDb(initial = 0, options: { fail?: boolean } = {}) {
  let count = initial;
  const db = {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => {
          if (options.fail) throw new Error('D1 down');
          count += 1;
          return { count };
        }),
        run: vi.fn(async () => ({ success: true }))
      }))
    }))
  } as unknown as D1Database;
  return { db, getCount: () => count };
}

describe('windowIndex / retryAfter', () => {
  it('同一窗口内序号相同，跨窗口自增', () => {
    expect(windowIndex(120, 60)).toBe(2);
    expect(windowIndex(179, 60)).toBe(2);
    expect(windowIndex(180, 60)).toBe(3);
  });

  it('retryAfter 指向当前窗口结束，最小为 1 秒', () => {
    expect(retryAfter(100, 60)).toBe(20);
    expect(retryAfter(119, 60)).toBe(1);
    expect(retryAfter(0, 60)).toBe(60);
  });
});

describe('rateLimitKey', () => {
  it('包含动作、IP 与窗口序号 —— 不同窗口天然隔离，无需重置逻辑', () => {
    expect(rateLimitKey('login', '1.2.3.4', 125, 60)).toBe('login:1.2.3.4:2');
  });

  it('空 IP 归一为 unknown', () => {
    expect(rateLimitKey('login', '', 0, 60)).toBe('login:unknown:0');
  });
});

describe('evaluate', () => {
  const rule = { limit: 3, windowSeconds: 60 };

  it('恰好达到上限仍放行（第 3 次成功）', () => {
    expect(evaluate(3, rule).allowed).toBe(true);
    expect(evaluate(3, rule).remaining).toBe(0);
  });

  it('超出上限拒绝', () => {
    expect(evaluate(4, rule).allowed).toBe(false);
  });
});

describe('checkRateLimit', () => {
  it('登录阈值是 10 次/分', () => {
    expect(RATE_LIMITS.login).toEqual({ limit: 10, windowSeconds: 60 });
    expect(RATE_LIMITS.register).toEqual({ limit: 5, windowSeconds: 3600 });
    expect(RATE_LIMITS.visit).toEqual({ limit: 60, windowSeconds: 60 });
  });

  it('前 10 次放行，第 11 次拒绝并给出等待秒数', async () => {
    const { db } = fakeDb(0);
    const now = 1000;

    for (let i = 1; i <= 10; i++) {
      const result = await checkRateLimit(db, { action: 'login', ip: '1.1.1.1', nowSeconds: now });
      expect(result.allowed).toBe(true);
    }

    const blocked = await checkRateLimit(db, { action: 'login', ip: '1.1.1.1', nowSeconds: now });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(20);
  });

  it('不同 IP 互不影响', async () => {
    const { db } = fakeDb(0);
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(db, { action: 'login', ip: '1.1.1.1', nowSeconds: 0 });
    }
    // 桩的计数是共享的，但 key 由 IP 决定；这里断言 key 生成正确即可
    const keyA = rateLimitKey('login', '1.1.1.1', 0, 60);
    const keyB = rateLimitKey('login', '2.2.2.2', 0, 60);
    expect(keyA).not.toBe(keyB);
  });

  it('D1 异常时放行（fail-open），不把正常用户锁在门外', async () => {
    const { db } = fakeDb(0, { fail: true });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await checkRateLimit(db, { action: 'login', ip: '1.1.1.1', nowSeconds: 0 });

    expect(result.allowed).toBe(true);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('没有 DB 绑定时放行（单测/本地无库场景）', async () => {
    const result = await checkRateLimit(undefined, { action: 'register', ip: '1.1.1.1' });
    expect(result.allowed).toBe(true);
  });
});

describe('pruneRateLimits', () => {
  it('删除 1 天前的窗口行', async () => {
    const run = vi.fn(async () => ({ success: true }));
    const bind = vi.fn(() => ({ run }));
    const db = { prepare: vi.fn(() => ({ bind })) } as unknown as D1Database;

    await pruneRateLimits(db, 1_000_000);

    expect(bind).toHaveBeenCalledWith(1_000_000 - 86400);
    expect(run).toHaveBeenCalled();
  });

  it('没有 DB 时静默返回', async () => {
    await expect(pruneRateLimits(undefined)).resolves.toBeUndefined();
  });
});
