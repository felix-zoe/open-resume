/**
 * 服务端可观测性基元（T5.6）。
 *
 * 抽成纯函数的理由与 security.ts / account.ts 一致：埋点的聚合口径一旦出错，
 * 表现是「报表看着正常但其实把两类事件算到了一起」，这种错误只能靠单测发现。
 *
 * 两条设计约束：
 * - **只聚合、不落原始事件**：D1 免费额度每天 10 万次写入，单条事件表很快就写满；
 *   而聚合表里没有 user_id / IP，泄露也不构成个人数据。
 * - **名称必须可控**：客户端传来的 name 若不做白名单式校验，
 *   一个恶意脚本就能往表里灌几百万个「新事件名」，报表当场失效。
 */

/** 单次上报的上限：正常一屏页面在 10 秒内攒不到 50 条 */
export const TELEMETRY_LIMITS = {
  maxEvents: 50,
  maxNameLength: 64,
  maxPathLength: 80,
  /** 单条 vital 的合理上界（毫秒 / 无量纲）。超过基本是伪造或计时器异常 */
  maxValue: 600_000
} as const;

export const TELEMETRY_KINDS = ['error', 'vital', 'event'] as const;
export type TelemetryKind = (typeof TELEMETRY_KINDS)[number];

/** 服务端自己记的事件统一带这个前缀，和客户端埋点区分开 */
export const SERVER_KIND = 'server' as const;

export interface RawTelemetryEvent {
  kind: unknown;
  name: unknown;
  path?: unknown;
  value?: unknown;
  message?: unknown;
}

export interface TelemetryRow {
  day: string;
  kind: string;
  name: string;
  path: string;
  count: number;
  totalValue: number;
}

/**
 * 名称白名单化。
 *
 * 只允许「字母数字 + . _ - :」，且必须以字母开头：这样既保留了
 * `export.pdf` / `auth.login.fail` 这类可读命名，又挡住了把用户输入
 * （含空格、中文、邮箱）直接当事件名的做法。
 */
export function isValidTelemetryName(name: unknown): name is string {
  if (typeof name !== 'string') return false;
  if (!name || name.length > TELEMETRY_LIMITS.maxNameLength) return false;
  return /^[a-zA-Z][a-zA-Z0-9._:-]*$/.test(name);
}

/**
 * 路径归一化。
 *
 * 客户端已经归一过一次，这里再归一一次是防「有人绕过前端直接打接口」：
 * 未归一化的 `/editor/res_abc123` 会让聚合表按 id 爆掉。
 */
export function normalizeTelemetryPath(path: unknown): string {
  const raw = typeof path === 'string' ? path : '';
  const clean = raw.split(/[?#]/)[0];
  const rules: Array<[RegExp, string]> = [
    [/^\/editor\/[^/]+/, '/editor/:id'],
    [/^\/share\/[^/]+/, '/share/:id'],
    [/^\/s\/[^/]+/, '/s/:token'],
    [/^\/examples\/[^/]+/, '/examples/:slug'],
    [/^\/api\/[^/]+/, '/api']
  ];
  for (const [pattern, replacement] of rules) {
    if (pattern.test(clean)) return replacement;
  }
  return clean.slice(0, TELEMETRY_LIMITS.maxPathLength) || '';
}

/** UTC 日期，与 D1 的 unixepoch() 对齐（不用本地时区，否则跨时区数据会分到两天） */
export function utcDay(nowSeconds = Math.floor(Date.now() / 1000)): string {
  return new Date(nowSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * 把一批原始事件聚合成「按 (kind, name, path) 的计数」。
 *
 * 非法事件直接丢弃而不是整批拒绝：埋点不该因为客户端某个版本多发了一个字段
 * 就让整次上报失败 —— 那等于把可观测性变成了可用性风险。
 */
export function aggregateTelemetry(
  events: unknown,
  options: { day?: string; kind?: string } = {}
): TelemetryRow[] {
  if (!Array.isArray(events)) return [];

  const day = options.day ?? utcDay();
  const buckets = new Map<string, TelemetryRow>();

  for (const raw of events.slice(0, TELEMETRY_LIMITS.maxEvents)) {
    if (!raw || typeof raw !== 'object') continue;
    const event = raw as RawTelemetryEvent;

    // 服务端事件由调用方指定 kind（`server`），客户端事件必须落在白名单里
    const kind =
      options.kind ??
      ((TELEMETRY_KINDS as readonly string[]).includes(String(event.kind))
        ? String(event.kind)
        : null);
    if (!kind || !isValidTelemetryName(event.name)) continue;

    // vital 的 value 必须是有限正数；事件/错误不带 value
    let value = 0;
    if (kind === 'vital') {
      const numeric = Number(event.value);
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > TELEMETRY_LIMITS.maxValue) continue;
      value = numeric;
    }

    const path = normalizeTelemetryPath(event.path);
    const key = `${kind}\u0000${event.name}\u0000${path}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalValue += value;
    } else {
      buckets.set(key, { day, kind, name: event.name, path, count: 1, totalValue: value });
    }
  }

  return [...buckets.values()];
}

/**
 * 写聚合表。
 *
 * `ON CONFLICT ... DO UPDATE` 让重复上报自然累加，不需要读-改-写，
 * 也就没有并发覆盖的问题。单次上报的条数上限是 50，足够用一条 batch 写完。
 */
export async function recordTelemetry(
  db: D1Database | undefined,
  events: unknown,
  options: { day?: string; kind?: string } = {}
): Promise<number> {
  if (!db) return 0;
  const rows = aggregateTelemetry(events, options);
  if (!rows.length) return 0;

  try {
    await db.batch(
      rows.map((row) =>
        db
          .prepare(
            `INSERT INTO telemetry_daily (day, kind, name, path, count, total_value)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(day, kind, name, path) DO UPDATE SET
               count = telemetry_daily.count + excluded.count,
               total_value = telemetry_daily.total_value + excluded.total_value`
          )
          .bind(row.day, row.kind, row.name, row.path, row.count, row.totalValue)
      )
    );
  } catch (err) {
    // 埋点写失败绝不能影响业务响应
    console.error(JSON.stringify({ level: 'warn', msg: 'telemetry write failed', err: String(err) }));
    return 0;
  }
  return rows.length;
}

/** 服务端直接记一次事件（如登录失败、导出失败），不经过客户端 */
export async function recordServerEvent(
  db: D1Database | undefined,
  name: string,
  options: { path?: string; value?: number } = {}
): Promise<void> {
  await recordTelemetry(db, [{ kind: 'event', name, path: options.path, value: options.value }], {
    kind: SERVER_KIND
  });
}

/** 请求 id：日志里靠它把「一次请求的所有行」串起来 */
export function createRequestId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

/**
 * 结构化日志。
 *
 * 一行一个 JSON 对象，Workers 的日志检索直接按字段过滤。
 * 不用多行缩进：日志是给机器读的，人要看的是 Logpush / `wrangler pages deployment tail`。
 */
export function logStructured(
  level: 'info' | 'warn' | 'error',
  fields: Record<string, unknown>
): void {
  const line = JSON.stringify({ level, ts: Math.floor(Date.now() / 1000), ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
