/**
 * 访问统计去伪。
 *
 * 目标不是「精确审计」，而是让工作台上的数字**能反映真实阅读量**。
 * 旧实现每次上报都插一行，结果是：
 *   · HR 刷新一次页面 = 多一次浏览；
 *   · 自己打开预览也计数；
 *   · 微信/飞书/Twitter 的链接预览爬虫也计数。
 *
 * 这里用三条互相独立的规则收敛：
 * 1. 已知爬虫 UA 直接丢弃；
 * 2. 同一 (IP + UA + 简历) 在窗口期内只记一次 —— 刷新不算新访客；
 * 3. 时长钳制到 0–1800s，挂机标签页不会把平均停留拉成几小时。
 */

/** 30 分钟：刷新/来回切换不该产生新的「浏览」 */
export const VISIT_DEDUP_WINDOW_SECONDS = 30 * 60;

/** 单次访问的最长计时，超过视为挂机 */
export const VISIT_MAX_DURATION_SECONDS = 1800;

/**
 * 已知爬虫/预览器特征。
 *
 * 刻意保守：宁可漏掉一些冷门爬虫，也不要误杀真实浏览器。
 * 微信内置浏览器（MicroMessenger）**不能**过滤 —— 那是真实 HR 的常用入口。
 */
const BOT_PATTERNS = [
  /bot\b/i,
  /crawler/i,
  /spider/i,
  /slurp/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /telegrambot/i,
  /whatsapp/i,
  /discordbot/i,
  /slackbot/i,
  /embedly/i,
  /quora link preview/i,
  /pinterest/i,
  /vkshare/i,
  /w3c_validator/i,
  /lighthouse/i,
  /headlesschrome/i,
  /phantomjs/i,
  /puppeteer/i,
  /playwright/i,
  /curl\//i,
  /wget/i,
  /python-requests/i,
  /go-http-client/i,
  /java\//i,
  /okhttp/i
];

/** 明显缺失 UA 的请求按非人类处理（真实浏览器一定带 UA） */
export function isBotUserAgent(userAgent: string | undefined | null): boolean {
  const ua = (userAgent || '').trim();
  if (!ua || ua.toLowerCase() === 'unknown') return true;
  return BOT_PATTERNS.some((pattern) => pattern.test(ua));
}

/** 把任意时长收敛到 [0, VISIT_MAX_DURATION_SECONDS]，非法值归零 */
export function clampDuration(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(VISIT_MAX_DURATION_SECONDS, Math.round(n));
}

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * 访客指纹：sha256(IP + UA + resumeId) 的前 16 个 hex 字符。
 *
 * 只用 IP 做去重会把同一公司的多个 HR 合并成一个；只用 UA 会把所有
 * 同版本浏览器合并成一个。两者相加再掺入简历 id，才能既区分访客
 * 又不跨简历串号。存哈希而非原文，避免在库里留下可识别个人的 IP。
 */
export async function visitorHash(
  ip: string | undefined | null,
  userAgent: string | undefined | null,
  resumeId: string
): Promise<string> {
  const input = `${ip || ''}|${userAgent || ''}|${resumeId}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return toHex(new Uint8Array(digest)).slice(0, 16);
}

/** 从 referer 里取域名，避免把完整 URL（可能含查询参数）落库 */
export function refererHost(referer: string | undefined | null): string {
  if (!referer) return '';
  try {
    return new URL(referer).host.slice(0, 100);
  } catch {
    return '';
  }
}

export interface VisitContext {
  ip?: string | null;
  userAgent?: string | null;
  country?: string | null;
  referer?: string | null;
}

export interface VisitDecision {
  /** 是否计入统计 */
  counted: boolean;
  /** 被过滤的原因，便于排查误杀 */
  reason?: 'bot' | 'duplicate';
  isBot: boolean;
  duration: number;
  visitorHash: string;
  country: string;
  referer: string;
}

/**
 * 决定一次上报是否计数。
 *
 * `recent` 由调用方传入「窗口期内的记录数」，让这里保持纯函数，
 * 数据库查询留在路由层 —— 这样规则本身能被单测完整覆盖。
 */
export async function decideVisit(
  input: {
    resumeId: string;
    duration: unknown;
    isDownloaded: boolean;
    context: VisitContext;
    recentCount: number;
  }
): Promise<VisitDecision> {
  const ua = input.context.userAgent || '';
  const isBot = isBotUserAgent(ua);
  const hash = await visitorHash(input.context.ip, ua, input.resumeId);
  const duration = clampDuration(input.duration);

  const base = {
    isBot,
    duration,
    visitorHash: hash,
    // 统一大写：CF-IPCountry 本身是大写，但本地调试或代理转发时可能不是
    country: (input.context.country || '').toUpperCase().slice(0, 8),
    referer: refererHost(input.context.referer)
  };

  if (isBot) return { ...base, counted: false, reason: 'bot' };

  // 下载是独立的用户动作：即使 30 分钟内已浏览过，也允许记录一次导出。
  // 否则「发给 3 个 HR，只有 1 次导出」这类数据会失真。
  if (!input.isDownloaded && input.recentCount > 0) {
    return { ...base, counted: false, reason: 'duplicate' };
  }

  return { ...base, counted: true };
}
