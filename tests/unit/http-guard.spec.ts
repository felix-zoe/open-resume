import { describe, expect, it } from 'vitest';
import {
  MAX_RESUME_BYTES,
  byteLength,
  clientIp,
  parseStoredJson,
  resolveAllowedOrigin,
  safeParse
} from '../../functions/lib/http';

describe('parseStoredJson', () => {
  it('正常 JSON 解析且不标记损坏', () => {
    const result = parseStoredJson('{"a":1}', {});
    expect(result.value).toEqual({ a: 1 });
    expect(result.corrupt).toBe(false);
  });

  it('空字符串/空值视为「没有内容」，不算损坏', () => {
    expect(parseStoredJson('', {})).toEqual({ value: {}, corrupt: false });
    expect(parseStoredJson('   ', {})).toEqual({ value: {}, corrupt: false });
    expect(parseStoredJson(null, {})).toEqual({ value: {}, corrupt: false });
  });

  it('脏数据不抛错，而是标记 corrupt —— 这是与裸 JSON.parse 的关键差别', () => {
    const result = parseStoredJson('{oops', { fallback: true });
    expect(result.value).toEqual({ fallback: true });
    expect(result.corrupt).toBe(true);
  });

  it('已解析对象直接透传（D1 某些绑定可能返回对象）', () => {
    const obj = { x: 1 };
    expect(parseStoredJson(obj, {})).toEqual({ value: obj, corrupt: false });
  });

  it('JSON 字面量 null 退化为 fallback，且不算损坏', () => {
    expect(parseStoredJson('null', {})).toEqual({ value: {}, corrupt: false });
  });
});

describe('safeParse', () => {
  it('只关心值，不暴露 corrupt 标记', () => {
    expect(safeParse('{"a":2}', {})).toEqual({ a: 2 });
    expect(safeParse('坏数据', { a: 0 })).toEqual({ a: 0 });
  });
});

describe('byteLength', () => {
  it('按 UTF-8 计算，中文不再被低估一半', () => {
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('中文')).toBe(6);
    // 4 字节 emoji
    expect(byteLength('😀')).toBe(4);
  });
});

describe('clientIp', () => {
  const headersOf = (map: Record<string, string>) => ({
    get: (name: string) => map[name] ?? null
  });

  it('优先使用 CF-Connecting-IP', () => {
    expect(clientIp(headersOf({ 'CF-Connecting-IP': '1.2.3.4', 'X-Forwarded-For': '9.9.9.9' }))).toBe(
      '1.2.3.4'
    );
  });

  it('无 CF 头时退回 X-Forwarded-For 的第一跳（本地 dev）', () => {
    expect(clientIp(headersOf({ 'X-Forwarded-For': '5.6.7.8, 10.0.0.1' }))).toBe('5.6.7.8');
  });

  it('都没有时返回 unknown，绝不返回空串（避免所有请求落到同一个限流桶）', () => {
    expect(clientIp(headersOf({}))).toBe('unknown');
  });
});

describe('resolveAllowedOrigin', () => {
  it('同源请求不带 Origin，不设置 CORS 头', () => {
    expect(resolveAllowedOrigin(undefined, 'https://a.com')).toBeUndefined();
  });

  it('白名单命中才放行', () => {
    expect(resolveAllowedOrigin('http://localhost:5173', 'http://localhost:5173')).toBe(
      'http://localhost:5173'
    );
    expect(resolveAllowedOrigin('http://evil.com', 'http://localhost:5173')).toBeUndefined();
  });

  it('支持逗号分隔的多来源，并忽略末尾斜杠差异', () => {
    const allow = 'http://localhost:5173, https://open-resume.pages.dev/';
    expect(resolveAllowedOrigin('https://open-resume.pages.dev', allow)).toBe(
      'https://open-resume.pages.dev'
    );
  });

  it('未配置 APP_ORIGIN 时不放行任何跨域来源（默认拒绝）', () => {
    expect(resolveAllowedOrigin('https://evil.com', undefined)).toBeUndefined();
    expect(resolveAllowedOrigin('https://evil.com', '')).toBeUndefined();
  });
});

describe('MAX_RESUME_BYTES', () => {
  it('上限为 512KB', () => {
    expect(MAX_RESUME_BYTES).toBe(512 * 1024);
  });
});
