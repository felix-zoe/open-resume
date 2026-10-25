/**
 * 固定窗口限流（D1 计数）。
 *
 * 为什么不用 Cloudflare Rate Limiting：那是账号级配置，无法随仓库走、
 * 本地开发与预览环境测不到，也无法在单测里断言。用一张小表换「可测试 + 可迁移」。
 *
 * 窗口键里带窗口序号（`action:ip:windowIndex`），于是计数天然按窗口隔离：
 * 新窗口写入新行，旧行由低频清理任务回收，不需要「先判断是否过期再重置」的竞态逻辑。
 */

export interface RateLimitRule {
  /** 窗口内允许的次数 */
  limit: number;
  /** 窗口长度（秒） */
  windowSeconds: number;
}

export const RATE_LIMITS = {
  /** 登录：10 次/分/IP —— 足够人手误输，挡住脚本撞库 */
  login: { limit: 10, windowSeconds: 60 },
  /** 注册：5 次/小时/IP —— 注册不该被反复触发 */
  register: { limit: 5, windowSeconds: 3600 },
  /** 分享页访问上报：60 次/分/IP —— 正常浏览远低于此 */
  visit: { limit: 60, windowSeconds: 60 },
  /** 分享密码尝试：10 次/分/IP —— 防止暴力猜 4 位密码 */
  unlock: { limit: 10, windowSeconds: 60 },
  /**
   * 埋点上报：120 次/分/IP。
   *
   * 正常一屏页面攒 20 条发一次、页面隐藏时再发一次，一分钟不会超过几次。
   * 给到 120 是留足「多个标签页同时开」的余量，同时挡住脚本灌数据。
   */
  telemetry: { limit: 120, windowSeconds: 60 },
  /**
   * AI 改写：30 次/分/IP。
   *
   * 成本由用户自己的 Key 承担，所以这里要挡的不是账单，而是「本站被当成
   * 一个绕过 CORS、可自由转发的代理」。30 次/分对正常使用（改一条看一条）
   * 绰绰有余，对脚本批量刷则远不够。
   */
  ai: { limit: 30, windowSeconds: 60 }
} satisfies Record<string, RateLimitRule>;

export type RateLimitAction = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  /** 本窗口剩余次数（已扣除本次） */
  remaining: number;
  /** 被拒时建议的等待秒数，供 `Retry-After` 使用 */
  retryAfterSeconds: number;
}

/** 窗口序号：同一窗口内的请求落到同一行 */
export function windowIndex(nowSeconds: number, windowSeconds: number): number {
  return Math.floor(nowSeconds / windowSeconds);
}

export function rateLimitKey(
  action: string,
  ip: string,
  nowSeconds: number,
  windowSeconds: number
): string {
  return `${action}:${ip || 'unknown'}:${windowIndex(nowSeconds, windowSeconds)}`;
}

/** 距当前窗口结束还有多久 —— 被拒时告诉客户端什么时候可以重试 */
export function retryAfter(nowSeconds: number, windowSeconds: number): number {
  const elapsed = nowSeconds % windowSeconds;
  return Math.max(1, windowSeconds - elapsed);
}

/** 纯函数部分：给定「本窗口已计次数」判断是否放行，便于单测 */
export function evaluate(count: number, rule: RateLimitRule): RateLimitResult {
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: 0
  };
}

/**
 * 计数并判定。
 *
 * 数据库异常时**放行**（fail-open）：限流是防滥用的辅助手段，
 * 不该在 D1 抖动时把正常用户全部锁在门外。异常会打日志，便于告警。
 */
export async function checkRateLimit(
  db: D1Database | undefined,
  input: { action: RateLimitAction; ip: string; nowSeconds?: number }
): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[input.action];
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const key = rateLimitKey(input.action, input.ip, now, rule.windowSeconds);
  const windowStart = windowIndex(now, rule.windowSeconds) * rule.windowSeconds;

  if (!db) {
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  try {
    const row: any = await db
      .prepare(
        `INSERT INTO rate_limits (key, window_start, count)
         VALUES (?, ?, 1)
         ON CONFLICT(key) DO UPDATE SET count = rate_limits.count + 1
         RETURNING count`
      )
      .bind(key, windowStart)
      .first();

    const count = Number(row?.count) || 1;

    // 每个窗口第一次写入时顺手清理过期行：频率天然受限于窗口长度
    // （每个动作每分钟最多 1 次），不需要额外的定时任务。
    if (count === 1) void pruneRateLimits(db, now);

    const result = evaluate(count, rule);
    return {
      allowed: result.allowed,
      remaining: result.remaining,
      retryAfterSeconds: result.allowed ? 0 : retryAfter(now, rule.windowSeconds)
    };
  } catch (err) {
    console.error('限流计数失败，已放行本次请求:', err);
    return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }
}

/** 清理一天前的窗口行；调用方低频触发即可（每次请求都清是浪费） */
export async function pruneRateLimits(db: D1Database | undefined, nowSeconds?: number): Promise<void> {
  if (!db) return;
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  await db
    .prepare('DELETE FROM rate_limits WHERE window_start < ?')
    .bind(now - 86400)
    .run()
    .catch(() => {});
}
