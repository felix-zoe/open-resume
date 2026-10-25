import { describe, expect, it } from 'vitest';
import {
  MAX_EMAIL_LENGTH,
  checkEmail,
  checkPassword,
  normalizeEmail,
  normalizeNickname
} from '../../functions/lib/validate';

describe('normalizeEmail', () => {
  it('去空格并转小写 —— 否则同一邮箱能注册两个账号', () => {
    expect(normalizeEmail('  Alice@Example.COM ')).toBe('alice@example.com');
  });

  it('非字符串输入返回空串，不抛错', () => {
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(123)).toBe('');
    expect(normalizeEmail(null)).toBe('');
  });

  it('超长输入被截断到 254，防止撑爆索引与日志', () => {
    const long = `${'a'.repeat(400)}@example.com`;
    expect(normalizeEmail(long).length).toBe(MAX_EMAIL_LENGTH);
  });
});

describe('checkEmail', () => {
  it('合法邮箱通过', () => {
    expect(checkEmail('a@b.co')).toBeNull();
    expect(checkEmail('zhang.san+job@mail.example.com')).toBeNull();
  });

  it('缺 @ / 缺域名 / 缺顶级域都拒绝', () => {
    expect(checkEmail('')).toBeTruthy();
    expect(checkEmail('abc')).toBeTruthy();
    expect(checkEmail('a@b')).toBeTruthy();
    expect(checkEmail('a@b.c')).toBeTruthy();
  });

  it('超过 254 字符拒绝', () => {
    expect(checkEmail(`${'a'.repeat(250)}@b.com`)).toContain('254');
  });
});

describe('checkPassword', () => {
  it('6 位是最低门槛，128 位是上限', () => {
    expect(checkPassword('123456')).toBeNull();
    expect(checkPassword('12345')).toContain('6');
    expect(checkPassword('a'.repeat(128))).toBeNull();
    expect(checkPassword('a'.repeat(129))).toContain('128');
  });

  it('非字符串或空串给出明确文案', () => {
    expect(checkPassword('')).toBe('请输入密码');
    expect(checkPassword(undefined)).toBe('请输入密码');
  });
});

describe('normalizeNickname', () => {
  it('留空时退回邮箱前缀', () => {
    expect(normalizeNickname('', 'zhangsan@example.com')).toBe('zhangsan');
    expect(normalizeNickname(undefined, 'lisi@example.com')).toBe('lisi');
  });

  it('超长昵称截断到 20 字符', () => {
    expect(normalizeNickname('名'.repeat(40), 'a@b.com')).toHaveLength(20);
  });

  it('纯空白视为未填', () => {
    expect(normalizeNickname('   ', 'wangwu@example.com')).toBe('wangwu');
  });
});
