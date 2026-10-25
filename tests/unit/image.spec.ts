import { describe, expect, it } from 'vitest';
import { base64Bytes, sniffImageType, validateAvatarFile } from '../../src/utils/image';

/** 构造带指定文件头的伪文件 */
function fileWithBytes(bytes: number[], name = 'a.bin', type = 'application/octet-stream') {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('sniffImageType', () => {
  it('识别 JPEG', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      'image/jpeg'
    );
  });

  it('识别 PNG', () => {
    expect(
      sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))
    ).toBe('image/png');
  });

  it('识别 GIF', () => {
    expect(sniffImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(
      'image/gif'
    );
  });

  it('识别 WebP', () => {
    expect(
      sniffImageType(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
      )
    ).toBe('image/webp');
  });

  it('拒绝非图片内容（即使扩展名是 .jpg）', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(sniffImageType(svg)).toBeNull();
  });

  it('字节数不足时返回 null 而不是误判', () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe('validateAvatarFile', () => {
  it('超过 5MB 直接拒绝', async () => {
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    const result = await validateAvatarFile(big);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('5MB');
  });

  it('伪造 MIME 的文本文件被拒绝', async () => {
    const fake = fileWithBytes(
      Array.from(new TextEncoder().encode('<script>alert(1)</script>')),
      'evil.png',
      'image/png'
    );
    const result = await validateAvatarFile(fake);

    expect(result.ok).toBe(false);
  });

  it('真实 PNG 头通过校验', async () => {
    const png = fileWithBytes(
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3],
      'ok.png',
      'image/png'
    );
    const result = await validateAvatarFile(png);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.type).toBe('image/png');
  });
});

describe('base64Bytes', () => {
  it('按 base64 长度推算原始字节数', () => {
    // 'AAAA' → 3 字节；'AAA=' → 2 字节
    expect(base64Bytes('data:image/png;base64,AAAA')).toBe(3);
    expect(base64Bytes('data:image/png;base64,AAA=')).toBe(2);
  });

  it('空内容为 0', () => {
    expect(base64Bytes('data:image/png;base64,')).toBe(0);
  });
});
