import { describe, expect, it } from 'vitest';
import {
  VISIT_DEDUP_WINDOW_SECONDS,
  VISIT_MAX_DURATION_SECONDS,
  clampDuration,
  decideVisit,
  isBotUserAgent,
  refererHost,
  visitorHash
} from '../../functions/lib/visit';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

describe('isBotUserAgent', () => {
  it('识别常见爬虫与链接预览器', () => {
    const bots = [
      'Googlebot/2.1 (+http://www.google.com/bot.html)',
      'facebookexternalhit/1.1',
      'Twitterbot/1.0',
      'LinkedInBot/1.0',
      'TelegramBot (like TwitterBot)',
      'Slackbot-LinkExpanding 1.0',
      'curl/8.4.0',
      'python-requests/2.31.0',
      'HeadlessChrome/120.0'
    ];
    for (const ua of bots) expect(isBotUserAgent(ua)).toBe(true);
  });

  it('真实浏览器不算爬虫', () => {
    expect(isBotUserAgent(CHROME_UA)).toBe(false);
    expect(
      isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')
    ).toBe(false);
  });

  it('微信内置浏览器必须放行 —— 那是真实 HR 的常用入口', () => {
    expect(
      isBotUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0.42 NetType/WIFI'
      )
    ).toBe(false);
  });

  it('缺失 UA 按非人类处理', () => {
    expect(isBotUserAgent('')).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent('Unknown')).toBe(true);
  });
});

describe('clampDuration', () => {
  it('负值与非法值归零', () => {
    expect(clampDuration(-5)).toBe(0);
    expect(clampDuration('abc')).toBe(0);
    expect(clampDuration(null)).toBe(0);
  });

  it('超过 30 分钟按上限截断', () => {
    expect(clampDuration(99_999)).toBe(VISIT_MAX_DURATION_SECONDS);
  });

  it('正常值取整保留', () => {
    expect(clampDuration(12.6)).toBe(13);
  });
});

describe('visitorHash', () => {
  it('同一 IP + UA + 简历得到相同指纹', async () => {
    const a = await visitorHash('1.2.3.4', CHROME_UA, 'res_1');
    const b = await visitorHash('1.2.3.4', CHROME_UA, 'res_1');
    expect(a).toBe(b);
  });

  it('换 IP / 换 UA / 换简历都会得到不同指纹', async () => {
    const base = await visitorHash('1.2.3.4', CHROME_UA, 'res_1');
    expect(await visitorHash('1.2.3.5', CHROME_UA, 'res_1')).not.toBe(base);
    expect(await visitorHash('1.2.3.4', `${CHROME_UA} x`, 'res_1')).not.toBe(base);
    expect(await visitorHash('1.2.3.4', CHROME_UA, 'res_2')).not.toBe(base);
  });

  it('输出为 16 位 hex，不落库原始 IP', async () => {
    const hash = await visitorHash('1.2.3.4', CHROME_UA, 'res_1');
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(hash).not.toContain('1.2.3.4');
  });
});

describe('refererHost', () => {
  it('只取域名，丢掉路径与查询参数', () => {
    expect(refererHost('https://www.linkedin.com/jobs/view/123?ref=x')).toBe('www.linkedin.com');
  });

  it('非法 referer 返回空串而不是抛错', () => {
    expect(refererHost('not a url')).toBe('');
    expect(refererHost(null)).toBe('');
  });
});

describe('decideVisit', () => {
  const context = { ip: '1.2.3.4', userAgent: CHROME_UA, country: 'cn', referer: 'https://example.com/a' };

  it('正常访客计数，时长被钳制', async () => {
    const result = await decideVisit({
      resumeId: 'res_1',
      duration: 5000,
      isDownloaded: false,
      context,
      recentCount: 0
    });
    expect(result.counted).toBe(true);
    expect(result.duration).toBe(VISIT_MAX_DURATION_SECONDS);
    expect(result.country).toBe('CN');
    expect(result.referer).toBe('example.com');
  });

  it('爬虫不计数且不写入原因之外的副作用', async () => {
    const result = await decideVisit({
      resumeId: 'res_1',
      duration: 10,
      isDownloaded: false,
      context: { ...context, userAgent: 'Googlebot/2.1' },
      recentCount: 0
    });
    expect(result.counted).toBe(false);
    expect(result.reason).toBe('bot');
    expect(result.isBot).toBe(true);
  });

  it('30 分钟内同一指纹的重复浏览被去重', async () => {
    const result = await decideVisit({
      resumeId: 'res_1',
      duration: 10,
      isDownloaded: false,
      context,
      recentCount: 1
    });
    expect(result.counted).toBe(false);
    expect(result.reason).toBe('duplicate');
  });

  it('下载是独立动作：窗口期内仍记录一次', async () => {
    const result = await decideVisit({
      resumeId: 'res_1',
      duration: 30,
      isDownloaded: true,
      context,
      recentCount: 1
    });
    expect(result.counted).toBe(true);
  });

  it('去重窗口常量为 30 分钟', () => {
    expect(VISIT_DEDUP_WINDOW_SECONDS).toBe(1800);
  });
});
