/**
 * 前端可观测性（T5.6）：错误上报、Web Vitals、业务埋点。
 *
 * 三条硬约束，都来自「隐私政策写了什么就必须是什么」：
 * 1. **不接第三方**：没有 Sentry / GA / 任何外域脚本，CSP 的 `connect-src 'self'` 也不允许。
 *    上报统一发到本站的 `/api/telemetry`，服务端只落「按天聚合的计数」，不存单条原始事件。
 * 2. **不带身份**：不传 token、不传邮箱、不传简历 id。路径里的动态段一律归一成 `:id`。
 * 3. **不阻塞**：批量 + `sendBeacon`，失败静默丢弃。埋点永远不能影响用户能不能用。
 *
 * 手写 Web Vitals 而不是引入 `web-vitals`：只需要 LCP/CLS/INP 三个值，
 * 一个依赖换 80 行代码不划算，也省掉一次「上报库自己是不是在偷偷发数据」的审计。
 */

const ENDPOINT = '/api/telemetry';

/** 攒够这么多条就立即发送 */
const MAX_BUFFER = 20;
/** 否则最多等这么久，避免短会话一条都不发 */
const FLUSH_DELAY_MS = 10_000;

export type TelemetryKind = 'error' | 'vital' | 'event';

export interface TelemetryItem {
  kind: TelemetryKind;
  name: string;
  /** 指标值（vital 用）；事件留空 */
  value?: number;
  /** 归一化后的页面路径，用于把「哪个页面在报错」和「哪个页面慢」分开 */
  path?: string;
  /** 仅错误事件携带；已脱敏，只进结构化日志，不进聚合表 */
  message?: string;
}

let buffer: TelemetryItem[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let installed = false;
/**
 * 默认关闭，必须由 `initTelemetry()` 显式打开。
 *
 * 反过来（默认开启）会让开发期与单测里的每一条 `trackEvent` 都真的发请求，
 * 既污染数据，也让「埋点是否生效」这件事无法在测试里断言。
 */
let enabled = false;

/**
 * 路径归一化。
 *
 * 原始路径里带着 `res_9b1d…`、`tok_ab12…` 这类 id：既会泄露用户资源标识，
 * 又会让聚合表每天多出几百个「新名字」，报表直接失效。
 */
const PATH_PATTERNS: Array<[RegExp, string]> = [
  [/^\/editor\/[^/]+/, '/editor/:id'],
  [/^\/share\/[^/]+/, '/share/:id'],
  [/^\/s\/[^/]+/, '/s/:token'],
  [/^\/examples\/[^/]+/, '/examples/:slug']
];

export function normalizePath(path: string | undefined | null): string {
  const clean = String(path || '/').split(/[?#]/)[0];
  for (const [pattern, replacement] of PATH_PATTERNS) {
    if (pattern.test(clean)) return replacement;
  }
  return clean.slice(0, 80) || '/';
}

/**
 * 抹掉错误信息里可能夹带的用户数据。
 *
 * 错误消息经常是 `Failed to fetch res_xxx` 或把用户输入的邮箱拼进去的校验提示。
 * 只保留前 200 字符，并把邮箱/手机号替换成占位符 —— 上报是为了定位问题，
 * 不是为了把用户数据再存一份。
 */
export function scrubMessage(message: unknown): string {
  return String(message ?? '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/\b1[3-9]\d{9}\b/g, '<phone>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/** 用户是否明确拒绝追踪（DNT / GPC） */
export function isOptedOut(): boolean {
  if (typeof navigator === 'undefined') return true;
  if ((navigator as any).doNotTrack === '1') return true;
  return (navigator as any).globalPrivacyControl === true;
}

function currentPath(): string {
  return typeof window === 'undefined' ? '/' : normalizePath(window.location.pathname);
}

function scheduleFlush() {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushTelemetry();
  }, FLUSH_DELAY_MS);
}

function push(item: TelemetryItem) {
  if (!enabled) return;
  buffer.push({ ...item, path: item.path ?? currentPath() });
  if (buffer.length >= MAX_BUFFER) {
    void flushTelemetry();
  } else {
    scheduleFlush();
  }
}

/**
 * 发送缓冲区。
 *
 * 页面隐藏时用 `sendBeacon`：普通 `fetch` 在 `pagehide` 之后大概率被浏览器取消，
 * 而这恰好是「用户看完就走」的典型场景 —— 恰恰是最需要上报的时候。
 */
export async function flushTelemetry(options: { beacon?: boolean } = {}): Promise<void> {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!buffer.length) return;

  const events = buffer;
  buffer = [];

  if (!enabled || isOptedOut()) return;

  const payload = JSON.stringify({ events });

  try {
    if (options.beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      // sendBeacon 只能发 Blob，且不会等待结果
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
      return;
    }
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    });
  } catch {
    // 上报失败就丢掉：重试会放大问题，且用户不需要知道埋点失败
  }
}

/** 业务埋点。name 用 `域.动作` 的稳定命名，便于按前缀聚合 */
export function trackEvent(name: string, value?: number) {
  if (!enabled || isOptedOut()) return;
  push({ kind: 'event', name, value });
}

export function trackVital(name: 'lcp' | 'cls' | 'inp', value: number) {
  if (!Number.isFinite(value) || value < 0) return;
  push({ kind: 'vital', name, value: Math.round(value * 1000) / 1000 });
}

export function trackError(error: unknown, name = 'window.error') {
  const message =
    error instanceof Error ? scrubMessage(`${error.name}: ${error.message}`) : scrubMessage(error);
  if (!message) return;
  push({ kind: 'error', name, message });
}

/**
 * 采集 Web Vitals。
 *
 * INP 这里用「最长事件处理时长」近似，而不是官方定义的 p98 交互延迟：
 * 后者需要在整页生命周期里保留所有交互样本，复杂度远超本项目需要。
 * 近似值的用途是「发现某次改版后交互明显变慢」，绝对值不追求与 Chrome 报告一致。
 */
function observeVitals(): (() => void) | undefined {
  if (typeof PerformanceObserver === 'undefined') return undefined;

  let lcp = 0;
  let cls = 0;
  let inp = 0;

  const observe = (type: string, handler: (entry: any) => void) => {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) handler(entry);
      });
      observer.observe({ type, buffered: true } as any);
    } catch {
      // 浏览器不支持该 entry 类型：跳过，不影响其他指标
    }
  };

  observe('largest-contentful-paint', (entry) => {
    lcp = Math.max(lcp, entry.startTime || 0);
  });

  observe('layout-shift', (entry) => {
    // 用户输入引起的位移不算「意外抖动」，官方 CLS 也排除
    if (!entry.hadRecentInput) cls += entry.value || 0;
  });

  observe('event', (entry) => {
    if (typeof entry.duration === 'number') inp = Math.max(inp, entry.duration);
  });

  // 指标只报一次：切到后台再切回来会再次触发 visibilitychange，
  // 重复上报会让均值被同一段页面生命周期算两次。
  // 但**缓冲区每次都要冲**：回来又离开时，这期间攒下的事件仍然要发出去。
  let vitalsReported = false;
  const report = () => {
    if (!vitalsReported) {
      vitalsReported = true;
      if (lcp > 0) trackVital('lcp', lcp);
      if (cls > 0) trackVital('cls', cls);
      if (inp > 0) trackVital('inp', inp);
    }
    void flushTelemetry({ beacon: true });
  };

  // 页面隐藏才是真正的「用户走了」；beforeunload 在移动端经常不触发
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') report();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', report);

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('pagehide', report);
  };
}

/**
 * 安装全局监听。
 *
 * 返回卸载函数：测试里需要能干净地拆掉，否则多个用例会共享同一批监听器。
 */
export function initTelemetry(options: { enabled?: boolean } = {}): () => void {
  enabled = options.enabled !== false && !isOptedOut();
  if (!enabled || installed) return () => {};
  installed = true;

  const onError = (event: ErrorEvent) => {
    // 资源加载失败（img/script）没有 error 对象，按名称单独记，避免刷屏
    if (!event.error) {
      trackError(`资源加载失败: ${scrubMessage(event.message)}`, 'resource.error');
      return;
    }
    trackError(event.error, 'window.error');
  };

  const onRejection = (event: PromiseRejectionEvent) => {
    trackError(event.reason, 'unhandledrejection');
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  const disposeVitals = observeVitals();

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    disposeVitals?.();
    installed = false;
    enabled = false;
  };
}

/** 仅测试使用：清空缓冲区与状态，避免用例之间互相污染 */
export function __resetTelemetry() {
  buffer = [];
  if (flushTimer !== null) clearTimeout(flushTimer);
  flushTimer = null;
  installed = false;
  enabled = false;
}
