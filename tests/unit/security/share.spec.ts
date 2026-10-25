import { describe, expect, it } from 'vitest';
import {
  SHARE_TTL_OPTIONS,
  expiresAtFrom,
  generateShareToken,
  maskEmail,
  maskPhone,
  maskResumeContent,
  resolveShareLinkState,
  shareStateMessage
} from '../../../functions/lib/share';

describe('generateShareToken', () => {
  it('默认长度 22，且只含安全字符集', () => {
    const token = generateShareToken();
    expect(token).toHaveLength(22);
    expect(token).toMatch(/^[23456789abcdefghjkmnpqrstuvwxyz]+$/);
  });

  it('连续生成不重复（不可预测性的最低要求）', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateShareToken()));
    expect(tokens.size).toBe(200);
  });

  it('不含易混淆字符 0/o/1/l/i', () => {
    for (let i = 0; i < 100; i++) {
      expect(generateShareToken()).not.toMatch(/[01oli]/);
    }
  });
});

describe('expiresAtFrom', () => {
  const NOW = 1_700_000_000;

  it('7 天 / 30 天换算成秒级时间戳', () => {
    expect(expiresAtFrom('7d', NOW)).toBe(NOW + 7 * 24 * 3600);
    expect(expiresAtFrom('30d', NOW)).toBe(NOW + 30 * 24 * 3600);
  });

  it('永久有效返回 null 而不是 0 或超大数', () => {
    expect(expiresAtFrom('permanent', NOW)).toBeNull();
  });

  it('枚举值与时长对应关系不被悄悄改掉', () => {
    expect(SHARE_TTL_OPTIONS['7d']).toBe(604800);
    expect(SHARE_TTL_OPTIONS['30d']).toBe(2592000);
    expect(SHARE_TTL_OPTIONS.permanent).toBeNull();
  });
});

describe('maskPhone', () => {
  it('11 位手机号保留前 3 后 4', () => {
    expect(maskPhone('13800138000')).toBe('138****8000');
  });

  it('带分隔符也能正确脱敏', () => {
    expect(maskPhone('138-0013-8000')).toBe('138****8000');
    expect(maskPhone('138 0013 8000')).toBe('138****8000');
  });

  it('短号整段打码，避免只剩几位仍可反推', () => {
    expect(maskPhone('8888')).toBe('****');
  });

  it('空值返回空串而不是一串星号', () => {
    expect(maskPhone('')).toBe('');
  });
});

describe('maskEmail', () => {
  it('保留首字母与完整域名', () => {
    expect(maskEmail('zhangxiaofan@example.com')).toBe('z***@example.com');
  });

  it('单字符本地部分也不泄露长度', () => {
    expect(maskEmail('a@example.com')).toBe('***@example.com');
  });

  it('无 @ 时整段打码', () => {
    expect(maskEmail('not-an-email')).toBe('***');
  });
});

describe('maskResumeContent', () => {
  const content = {
    profile: {
      name: '张小凡',
      phone: '13800138000',
      email: 'zhangxiaofan@example.com',
      summary: '5 年前端经验'
    },
    modulesOrder: ['work']
  };

  it('只改联系方式，其余字段原样保留', () => {
    const masked = maskResumeContent(content);
    expect(masked.profile.phone).toBe('138****8000');
    expect(masked.profile.email).toBe('z***@example.com');
    expect(masked.profile.name).toBe('张小凡');
    expect(masked.profile.summary).toBe('5 年前端经验');
    expect(masked.modulesOrder).toEqual(['work']);
  });

  it('不修改入参（返回副本）', () => {
    maskResumeContent(content);
    expect(content.profile.phone).toBe('13800138000');
  });

  it('缺 profile 时原样返回，不抛错', () => {
    expect(maskResumeContent({} as any)).toEqual({});
  });
});

describe('resolveShareLinkState', () => {
  const NOW = 1_700_000_000;

  it('正常链接为 ok', () => {
    expect(resolveShareLinkState({ id: 'a', resume_id: 'r', token: 't' }, NOW)).toBe('ok');
  });

  it('撤销优先于过期', () => {
    expect(
      resolveShareLinkState(
        { id: 'a', resume_id: 'r', token: 't', revoked_at: 1, expires_at: NOW - 1 },
        NOW
      )
    ).toBe('revoked');
  });

  it('已过期', () => {
    expect(
      resolveShareLinkState({ id: 'a', resume_id: 'r', token: 't', expires_at: NOW }, NOW)
    ).toBe('expired');
  });

  it('expires_at 为 null 视为永久有效', () => {
    expect(
      resolveShareLinkState({ id: 'a', resume_id: 'r', token: 't', expires_at: null }, NOW)
    ).toBe('ok');
  });

  it('有密码时为 needs-password', () => {
    expect(
      resolveShareLinkState(
        { id: 'a', resume_id: 'r', token: 't', password_hash: 'pbkdf2:...' },
        NOW
      )
    ).toBe('needs-password');
  });

  it('记录不存在按已撤销处理', () => {
    expect(resolveShareLinkState(null, NOW)).toBe('revoked');
  });
});

describe('shareStateMessage', () => {
  it('过期与撤销给出不同文案，便于用户判断该找谁', () => {
    expect(shareStateMessage('expired')).toContain('过期');
    expect(shareStateMessage('revoked')).toContain('失效');
  });

  it('ok 状态无文案', () => {
    expect(shareStateMessage('ok')).toBe('');
  });
});
