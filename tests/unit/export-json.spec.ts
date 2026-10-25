import { describe, expect, it } from 'vitest';
import {
  EXPORT_SCHEMA,
  buildExportPayload,
  parseImportPayload,
  serializeExport
} from '../../src/utils/exportJson';
import { buildExportFilename } from '../../src/utils/exportFilename';
import type { ResumeContent, ThemeConfig } from '../../src/types/resume';

const content = {
  profile: {
    name: '张三',
    title: '前端工程师',
    email: 'a@b.com',
    phone: '13800138000',
    showAvatar: false
  },
  modulesOrder: ['work', 'projects', 'skills', 'education', 'custom'],
  modules: {
    work: { visible: true, title: '工作经历', items: [] },
    projects: { visible: true, title: '项目经历', items: [] },
    skills: { visible: true, title: '专业技能', items: ['Vue3'] },
    education: { visible: true, title: '教育背景', items: [] },
    custom: { visible: false, title: '自定义模块', items: [] }
  }
} as unknown as ResumeContent;

const theme = { themeColor: '#2563eb', fontSize: 13 } as ThemeConfig;

describe('buildExportPayload', () => {
  it('带 schema 与 version，便于导入时识别文件类型', () => {
    const payload = buildExportPayload({
      title: '我的简历',
      templateId: 'modern',
      themeConfig: theme,
      content
    });
    expect(payload.schema).toBe(EXPORT_SCHEMA);
    expect(payload.version).toBe(1);
    expect(payload.templateId).toBe('modern');
  });

  it('exportedAt 使用注入的时间，便于测试', () => {
    const payload = buildExportPayload({
      title: 'x',
      templateId: 'classic',
      themeConfig: theme,
      content,
      now: new Date('2026-10-24T00:00:00Z')
    });
    expect(payload.exportedAt).toBe('2026-10-24T00:00:00.000Z');
  });
});

describe('serializeExport', () => {
  it('缩进输出，方便人读与 diff', () => {
    const text = serializeExport(
      buildExportPayload({ title: 'x', templateId: 'classic', themeConfig: theme, content })
    );
    expect(text).toContain('\n  "schema"');
  });
});

describe('parseImportPayload', () => {
  const validPayload = buildExportPayload({
    title: '我的简历',
    templateId: 'modern',
    themeConfig: theme,
    content
  });

  it('往返无损', () => {
    const result = parseImportPayload(serializeExport(validPayload));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.title).toBe('我的简历');
      expect(result.payload.templateId).toBe('modern');
      expect(result.payload.content.profile.name).toBe('张三');
    }
  });

  it('非 JSON 给出明确错误', () => {
    const result = parseImportPayload('not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('JSON');
  });

  it('拒绝其他产品的文件（schema 不匹配）', () => {
    const result = parseImportPayload(JSON.stringify({ schema: 'other/resume', content }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('不支持的文件类型');
  });

  it('缺 content.profile 时拒绝 —— 否则渲染会直接崩', () => {
    const result = parseImportPayload(JSON.stringify({ title: 'x' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('content.profile');
  });

  it('无 schema 的裸简历对象也能导入（兼容早期导出）', () => {
    const result = parseImportPayload(JSON.stringify({ profile: content.profile, modules: content.modules }));
    expect(result.ok).toBe(true);
  });

  it('缺 title 时回退到默认标题而不是空串', () => {
    const result = parseImportPayload(JSON.stringify({ content }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.title).toBe('导入的简历');
  });

  it('缺 themeConfig 时给空对象，避免写入 undefined', () => {
    const result = parseImportPayload(JSON.stringify({ content }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.themeConfig).toEqual({});
  });
});

describe('buildExportFilename', () => {
  it('拼接姓名_意向_年限', () => {
    expect(
      buildExportFilename({ name: '张三', title: '前端工程师', workYears: '5年', ext: 'pdf' })
    ).toBe('张三_前端工程师_5年.pdf');
  });

  it('缺失字段跳过，不留多余下划线', () => {
    expect(buildExportFilename({ name: '张三', ext: 'docx' })).toBe('张三.docx');
  });

  it('去掉文件名非法字符', () => {
    expect(buildExportFilename({ name: 'a/b:c', ext: 'pdf' })).toBe('abc.pdf');
  });

  it('全部缺失时用 fallback', () => {
    expect(buildExportFilename({ fallback: '我的简历', ext: 'md' })).toBe('我的简历.md');
  });
});
