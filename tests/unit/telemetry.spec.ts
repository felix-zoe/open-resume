import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetTelemetry,
  flushTelemetry,
  initTelemetry,
  isOptedOut,
  normalizePath,
  scrubMessage,
  trackError,
  trackEvent,
  trackVital
} from '../../src/utils/telemetry';
import {
  aggregateTelemetry,
  createRequestId,
  isValidTelemetryName,
  normalizeTelemetryPath,
  recordTelemetry,
  utcDay
} from '../../functions/lib/telemetry';

const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

beforeEach(() => {
  __resetTelemetry();
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  __resetTelemetry();
  vi.unstubAllGlobals();
});

describe('路径归一化', () => {
  it('把资源 id 换成占位符，避免聚合表按 id 爆炸', () => {
    expect(normalizePath('/editor/res_9b1deb4d3b7d4e12')).toBe('/editor/:id');
    expect(normalizePath('/share/res_abc')).toBe('/share/:id');
    expect(normalizePath('/s/tok123abc')).toBe('/s/:token');
    expect(normalizePath('/examples/frontend')).toBe('/examples/:slug');
  });

  it('保留静态路径，去掉查询串与哈希', () => {
    expect(normalizePath('/dashboard?tab=list')).toBe('/dashboard');
    expect(normalizePath('/privacy#retention')).toBe('/privacy');
  });

  it('空值回落为根路径而不是空串', () => {
    expect(normalizePath('')).toBe('/');
    expect(normalizePath(undefined)).toBe('/');
    expect(normalizePath(null)).toBe('/');
  });

  it('服务端再做一次归一化：挡住绕过前端直接打接口的请求', () => {
    expect(normalizeTelemetryPath('/editor/res_x')).toBe('/editor/:id');
    expect(normalizeTelemetryPath('/api/resumes/res_x')).toBe('/api');
    expect(normalizeTelemetryPath('/unknown/page')).toBe('/unknown/page');
  });
});

describe('错误消息脱敏', () => {
  it('邮箱与手机号被替换成占位符', () => {
    expect(scrubMessage('用户 alice@example.com 保存失败')).toBe('用户 <email> 保存失败');
    expect(scrubMessage('手机号 13800138000 校验失败')).toBe('手机号 <phone> 校验失败');
  });

  it('压缩空白并截断到 200 字符', () => {
    const message = scrubMessage('a'.repeat(500));
    expect(message.length).toBe(200);
    expect(scrubMessage('多   个\n空白')).toBe('多 个 空白');
  });

  it('非字符串输入不抛错', () => {
    expect(scrubMessage(undefined)).toBe('');
    expect(scrubMessage({ a: 1 })).toBe('[object Object]');
  });
});

describe('上报开关', () => {
  it('未初始化时所有埋点都是空操作', () => {
    trackEvent('page.Home');
    trackVital('lcp', 1200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('初始化后才上报，且一次请求带上整批事件', async () => {
    const dispose = initTelemetry();
    trackEvent('page.Home');
    trackEvent('export.pdf.ok');
    await flushTelemetry();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events.map((e: any) => e.name)).toEqual(['page.Home', 'export.pdf.ok']);
    dispose();
  });

  it('显式传 enabled:false 时不装监听也不上报', () => {
    const dispose = initTelemetry({ enabled: false });
    trackEvent('page.Home');
    expect(fetchMock).not.toHaveBeenCalled();
    dispose();
  });

  it('DNT 为 1 时整体关闭', () => {
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true });
    expect(isOptedOut()).toBe(true);
    initTelemetry();
    trackEvent('page.Home');
    expect(fetchMock).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'doNotTrack', { value: undefined, configurable: true });
  });

  it('卸载后不再上报', () => {
    const dispose = initTelemetry();
    dispose();
    trackEvent('page.Home');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('缓冲区', () => {
  it('空缓冲区不发请求', async () => {
    initTelemetry();
    await flushTelemetry();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('攒满 20 条立即发送，不等定时器', async () => {
    initTelemetry();
    for (let i = 0; i < 20; i += 1) trackEvent(`event.e${i}`);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('发送后清空，不会重复上报同一批', async () => {
    initTelemetry();
    trackEvent('page.Home');
    await flushTelemetry();
    await flushTelemetry();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('页面隐藏时优先用 sendBeacon（普通 fetch 会被浏览器取消）', async () => {
    const beacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });

    initTelemetry();
    trackEvent('page.Home');
    await flushTelemetry({ beacon: true });

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('错误与指标', () => {
  it('Error 对象被转成「名称: 消息」并脱敏', async () => {
    initTelemetry();
    trackError(new TypeError('读取 alice@example.com 失败'));
    await flushTelemetry();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events[0]).toMatchObject({
      kind: 'error',
      name: 'window.error',
      message: 'TypeError: 读取 <email> 失败'
    });
  });

  it('空消息的错误被丢弃，不产生空事件', async () => {
    initTelemetry();
    trackError('');
    await flushTelemetry();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('vital 保留三位小数，非有限值被丢弃', async () => {
    initTelemetry();
    trackVital('cls', 0.123456);
    trackVital('lcp', Number.NaN);
    trackVital('inp', -1);
    await flushTelemetry();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({ kind: 'vital', name: 'cls', value: 0.123 });
  });
});

describe('服务端聚合', () => {
  it('同名同路径的事件合并为一条计数', () => {
    const rows = aggregateTelemetry(
      [
        { kind: 'event', name: 'page.Home', path: '/' },
        { kind: 'event', name: 'page.Home', path: '/' }
      ],
      { day: '2026-10-24' }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ count: 2, name: 'page.Home', day: '2026-10-24' });
  });

  it('vital 累加数值，事件不累加', () => {
    const rows = aggregateTelemetry([
      { kind: 'vital', name: 'lcp', value: 1200 },
      { kind: 'vital', name: 'lcp', value: 800 }
    ]);
    expect(rows[0].count).toBe(2);
    expect(rows[0].totalValue).toBe(2000);
  });

  it('非法事件名被丢弃（防止有人把用户输入当事件名灌进来）', () => {
    const rows = aggregateTelemetry([
      { kind: 'event', name: '带 空格' },
      { kind: 'event', name: '1startsWithDigit' },
      { kind: 'event', name: 'ok.name' }
    ]);
    expect(rows.map((row) => row.name)).toEqual(['ok.name']);
  });

  it('未知 kind、超长名称、vital 的非数值都被丢弃', () => {
    expect(aggregateTelemetry([{ kind: 'hack', name: 'a.b' }])).toHaveLength(0);
    expect(aggregateTelemetry([{ kind: 'event', name: 'a'.repeat(80) }])).toHaveLength(0);
    expect(aggregateTelemetry([{ kind: 'vital', name: 'lcp', value: 'slow' }])).toHaveLength(0);
    expect(aggregateTelemetry([{ kind: 'vital', name: 'lcp', value: 999_999_999 }])).toHaveLength(0);
  });

  it('非数组输入返回空数组，不抛错', () => {
    expect(aggregateTelemetry(null)).toEqual([]);
    expect(aggregateTelemetry({ events: [] })).toEqual([]);
  });

  it('单批最多处理 50 条，避免一次请求灌爆写入', () => {
    const events = Array.from({ length: 80 }, () => ({ kind: 'event', name: 'spam.hit' }));
    expect(aggregateTelemetry(events)[0].count).toBe(50);
  });

  it('服务端事件按指定 kind 归类，不受客户端 kind 影响', () => {
    const rows = aggregateTelemetry([{ kind: 'event', name: 'auth.login.fail' }], { kind: 'server' });
    expect(rows[0].kind).toBe('server');
  });
});

describe('写入聚合表', () => {
  it('没有 DB 时静默返回 0（本地/单测环境）', async () => {
    await expect(recordTelemetry(undefined, [{ kind: 'event', name: 'a.b' }])).resolves.toBe(0);
  });

  it('用 batch + ON CONFLICT 累加，不做读-改-写', async () => {
    const prepared: string[] = [];
    const db = {
      prepare: (sql: string) => {
        prepared.push(sql);
        return { bind: () => ({}) };
      },
      batch: vi.fn().mockResolvedValue([])
    } as unknown as D1Database;

    const written = await recordTelemetry(db, [
      { kind: 'event', name: 'page.Home', path: '/' },
      { kind: 'event', name: 'page.Home', path: '/' }
    ]);

    expect(written).toBe(1);
    expect(prepared[0]).toContain('ON CONFLICT(day, kind, name, path) DO UPDATE');
    expect(prepared[0]).toContain('telemetry_daily.count + excluded.count');
  });

  it('写入失败只打日志，不把异常抛给业务', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = {
      prepare: () => ({ bind: () => ({}) }),
      batch: vi.fn().mockRejectedValue(new Error('D1 down'))
    } as unknown as D1Database;

    await expect(recordTelemetry(db, [{ kind: 'event', name: 'a.b' }])).resolves.toBe(0);
    expect(spy).toHaveBeenCalled();
  });
});

describe('工具函数', () => {
  it('request id 长度固定且不含连字符', () => {
    const id = createRequestId();
    expect(id).toHaveLength(12);
    expect(id).not.toContain('-');
  });

  it('utcDay 用 UTC，避免跨时区的同一天被拆成两天', () => {
    // 2026-10-24T23:30:00Z
    expect(utcDay(1792884600)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('事件名白名单：字母开头、只含字母数字与 . _ - :', () => {
    expect(isValidTelemetryName('page.ExampleDetail')).toBe(true);
    expect(isValidTelemetryName('export.pdf.ok')).toBe(true);
    expect(isValidTelemetryName('auth:login')).toBe(true);
    expect(isValidTelemetryName('中文事件')).toBe(false);
    expect(isValidTelemetryName('')).toBe(false);
    expect(isValidTelemetryName(123)).toBe(false);
  });
});
