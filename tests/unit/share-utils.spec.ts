import { describe, expect, it } from 'vitest';
import {
  absoluteShareUrl,
  formatDate,
  formatExpiry,
  isLinkUsable,
  shareStatusLabel,
  shareStatusTone
} from '../../src/utils/share';

const NOW = Math.floor(new Date('2026-10-24T12:00:00Z').getTime() / 1000);

describe('absoluteShareUrl', () => {
  it('拼出 /s/:token 形式的绝对地址', () => {
    expect(absoluteShareUrl('abc234', 'https://open-resume.pages.dev')).toBe(
      'https://open-resume.pages.dev/s/abc234'
    );
  });
});

describe('formatExpiry', () => {
  it('null 视为永久有效', () => {
    expect(formatExpiry(null, NOW)).toBe('永久有效');
  });

  it('已过期用「已过期」而不是一个过去的日期', () => {
    expect(formatExpiry(NOW - 1, NOW)).toBe('已过期');
    expect(formatExpiry(NOW, NOW)).toBe('已过期');
  });

  it('未来时间显示日期 + 到期', () => {
    const future = Math.floor(new Date('2026-11-23T12:00:00Z').getTime() / 1000);
    expect(formatExpiry(future, NOW)).toBe('2026-11-23 到期');
  });
});

describe('formatDate', () => {
  it('月份与日期补零', () => {
    const ts = Math.floor(new Date('2026-03-05T08:00:00Z').getTime() / 1000);
    // 本地时区可能跨日，这里只断言格式
    expect(formatDate(ts)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('空值返回空串', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(0)).toBe('');
  });
});

describe('shareStatusLabel / shareStatusTone', () => {
  it('四种状态各有独立文案', () => {
    const labels = (['ok', 'expired', 'revoked', 'needs-password'] as const).map(shareStatusLabel);
    expect(new Set(labels).size).toBe(4);
  });

  it('生效中为 success，已过期不误标为成功', () => {
    expect(shareStatusTone('ok')).toBe('success');
    expect(shareStatusTone('expired')).toBe('warning');
    expect(shareStatusTone('revoked')).toBe('neutral');
  });
});

describe('isLinkUsable', () => {
  it('撤销/过期不可再复制', () => {
    expect(isLinkUsable({ status: 'revoked' })).toBe(false);
    expect(isLinkUsable({ status: 'expired' })).toBe(false);
  });

  it('有密码与正常状态都可用', () => {
    expect(isLinkUsable({ status: 'ok' })).toBe(true);
    expect(isLinkUsable({ status: 'needs-password' })).toBe(true);
  });
});
