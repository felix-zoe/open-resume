import { describe, expect, it } from 'vitest';
import {
  hashPasswordPBKDF2,
  verifyPassword,
  requireJwtSecret,
  isMissingSecretError
} from '../../../functions/lib/security';

const LEGACY_SALT = 'open_resume_salt_2026';

async function legacyHash(password: string): Promise<string> {
  const data = new TextEncoder().encode(password + LEGACY_SALT);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('hashPasswordPBKDF2', () => {
  it('生成带迭代次数与独立盐的哈希', async () => {
    const hash = await hashPasswordPBKDF2('mySecret2026');
    expect(hash.startsWith('pbkdf2:100000:')).toBe(true);
    expect(hash.split(':')).toHaveLength(4);
  });

  it('相同密码每次生成不同的盐与哈希', async () => {
    const a = await hashPasswordPBKDF2('samePassword');
    const b = await hashPasswordPBKDF2('samePassword');
    expect(a).not.toBe(b);
  });
});

describe('verifyPassword', () => {
  it('正确密码通过且无需升级', async () => {
    const hash = await hashPasswordPBKDF2('mySecret2026');
    await expect(verifyPassword('mySecret2026', hash)).resolves.toEqual({
      isValid: true,
      needsUpgrade: false
    });
  });

  it('错误密码失败', async () => {
    const hash = await hashPasswordPBKDF2('mySecret2026');
    await expect(verifyPassword('wrongPassword', hash)).resolves.toEqual({
      isValid: false,
      needsUpgrade: false
    });
  });

  it('旧版 SHA-256 哈希通过并标记升级', async () => {
    const legacy = await legacyHash('legacyPassword');
    await expect(verifyPassword('legacyPassword', legacy)).resolves.toEqual({
      isValid: true,
      needsUpgrade: true
    });
    await expect(verifyPassword('nope', legacy)).resolves.toEqual({
      isValid: false,
      needsUpgrade: false
    });
  });

  it('损坏的 pbkdf2 哈希不会抛错', async () => {
    await expect(verifyPassword('x', 'pbkdf2:100000:zzzz:zzzz')).resolves.toEqual({
      isValid: false,
      needsUpgrade: false
    });
    await expect(verifyPassword('x', 'pbkdf2:broken')).resolves.toEqual({
      isValid: false,
      needsUpgrade: false
    });
  });
});

describe('requireJwtSecret', () => {
  it('缺失时抛错而不是回退默认密钥', () => {
    expect(() => requireJwtSecret({})).toThrow(/JWT_SECRET 未配置/);
    expect(() => requireJwtSecret({ JWT_SECRET: '   ' })).toThrow(/JWT_SECRET 未配置/);
    expect(() => requireJwtSecret(undefined)).toThrow(/JWT_SECRET 未配置/);
  });

  it('有值时返回密钥', () => {
    expect(requireJwtSecret({ JWT_SECRET: 'real-secret' })).toBe('real-secret');
  });

  it('可识别密钥缺失错误', () => {
    try {
      requireJwtSecret({});
    } catch (err) {
      expect(isMissingSecretError(err)).toBe(true);
    }
    expect(isMissingSecretError(new Error('other'))).toBe(false);
  });
});
