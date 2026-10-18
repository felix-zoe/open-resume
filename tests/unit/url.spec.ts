import { describe, expect, it } from 'vitest';
import { safeUrl, isSafeUrl } from '../../src/utils/url';

describe('safeUrl', () => {
  it('accepts http and https urls', () => {
    expect(safeUrl('https://github.com/example')).toBe('https://github.com/example');
    expect(safeUrl('http://example.com/a?b=1')).toBe('http://example.com/a?b=1');
  });

  it('rejects javascript and data protocols', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('JavaScript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(safeUrl('vbscript:msgbox(1)')).toBeNull();
    expect(safeUrl('file:///etc/passwd')).toBeNull();
  });

  it('rejects protocol-relative urls', () => {
    expect(safeUrl('//evil.example.com')).toBeNull();
  });

  it('rejects control characters that could split the scheme', () => {
    expect(safeUrl('java\nscript:alert(1)')).toBeNull();
    expect(safeUrl('java\tscript:alert(1)')).toBeNull();
    expect(safeUrl('  javascript:alert(1)  ')).toBeNull();
  });

  it('adds https to bare domains', () => {
    expect(safeUrl('github.com/example')).toBe('https://github.com/example');
    expect(safeUrl('blog.example.com')).toBe('https://blog.example.com/');
  });

  it('rejects bare words that are not domains', () => {
    expect(safeUrl('not a url')).toBeNull();
    expect(safeUrl('example')).toBeNull();
    expect(safeUrl('/relative/path')).toBeNull();
  });

  it('handles empty values', () => {
    expect(safeUrl('')).toBeNull();
    expect(safeUrl('   ')).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });

  it('exposes a boolean helper', () => {
    expect(isSafeUrl('https://a.com')).toBe(true);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
  });
});
