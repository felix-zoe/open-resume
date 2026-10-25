import { describe, expect, it } from 'vitest';
import { TEMPLATES, findTemplate } from '../../src/constants/templates';
import { TEMPLATE_IDS } from '../../shared/types';

/**
 * 模板元数据与白名单必须同步。
 *
 * 曾经出现过「前端能选到新模板、服务端 schema 白名单没加」的情况：
 * 编辑器里切换正常，一保存就 400，而用户看不出是模板 id 的问题。
 */
describe('模板注册表一致性', () => {
  it('前端模板列表与服务端白名单完全一致', () => {
    const frontend = TEMPLATES.map((template) => template.id).sort();
    const backend = [...TEMPLATE_IDS].sort();
    expect(frontend).toEqual(backend);
  });

  it('每个模板都有完整的元数据', () => {
    for (const template of TEMPLATES) {
      expect(template.name).toBeTruthy();
      expect(template.shortName).toBeTruthy();
      expect(template.description.length).toBeGreaterThan(10);
      expect(template.industry.length).toBeGreaterThan(0);
      expect([1, 2]).toContain(template.columns);
    }
  });

  it('至少有一个 ATS 友好模板，且它必须是单栏、无照片', () => {
    const atsSafe = TEMPLATES.filter((template) => template.atsSafe);
    expect(atsSafe.length).toBeGreaterThan(0);
    for (const template of atsSafe) {
      expect(template.columns).toBe(1);
      expect(template.photo).toBe(false);
    }
  });

  it('模板 id 不重复', () => {
    const ids = TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('未知 id 回退到第一个模板而不是抛错', () => {
    expect(findTemplate('nonexistent').id).toBe(TEMPLATES[0].id);
    expect(findTemplate(undefined).id).toBe(TEMPLATES[0].id);
  });
});
