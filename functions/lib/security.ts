/**
 * 服务端安全基元：密码哈希与 JWT 密钥。
 *
 * 从 `functions/api/[[route]].ts` 抽出，目的是让这些纯函数可以被 Vitest 直接
 * 覆盖，并确保「密钥缺失」在服务端是**显式失败**而不是回退到硬编码默认值。
 */

const LEGACY_SALT = 'open_resume_salt_2026';
const PBKDF2_ITERATIONS = 100_000;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string): Uint8Array<ArrayBuffer> => {
  const pairs = hex.match(/.{1,2}/g);
  if (!pairs) throw new Error('非法的十六进制字符串');
  return new Uint8Array(pairs.map((byte) => parseInt(byte, 16)));
};

async function derivePbkdf2(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return toHex(new Uint8Array(bits));
}

/** 生成 `pbkdf2:iterations:salt:hash` 格式的密码哈希（每用户独立随机盐） */
export async function hashPasswordPBKDF2(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toHex(salt)}:${hash}`;
}

/** 校验密码；旧版固定盐 SHA-256 命中时标记 needsUpgrade，供登录后平滑升级 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<{ isValid: boolean; needsUpgrade: boolean }> {
  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':');
    if (parts.length === 4) {
      const iterations = parseInt(parts[1], 10) || PBKDF2_ITERATIONS;
      try {
        const hash = await derivePbkdf2(password, fromHex(parts[2]), iterations);
        return { isValid: hash === parts[3], needsUpgrade: false };
      } catch {
        return { isValid: false, needsUpgrade: false };
      }
    }
    return { isValid: false, needsUpgrade: false };
  }

  // 兼容旧版：password + 固定盐 的 SHA-256
  const data = new TextEncoder().encode(password + LEGACY_SALT);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const legacyHash = toHex(new Uint8Array(digest));
  return { isValid: legacyHash === storedHash, needsUpgrade: legacyHash === storedHash };
}

/**
 * 读取 JWT 密钥。缺失时**抛错**——绝不回退到源码里的默认字符串，
 * 否则任何人都能伪造 Token 访问他人简历。
 */
export function requireJwtSecret(env: { JWT_SECRET?: string } | undefined | null): string {
  const secret = env?.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET 未配置：请执行 `wrangler secret put JWT_SECRET` 或写入 .dev.vars');
  }
  return secret;
}

/** 判断是否为「密钥缺失」错误，便于路由层返回 50003 而不是 500 泛化错误 */
export function isMissingSecretError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('JWT_SECRET 未配置');
}
