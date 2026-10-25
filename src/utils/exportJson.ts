/**
 * JSON 导出 / 导入的载荷格式。
 *
 * 带 `schema` 与 `version` 是为了两件事：
 * 1. 导入时能识别「这是不是本产品的文件」，而不是让用户把任意 JSON 塞进来；
 * 2. 以后字段结构变更时可以按版本做兼容迁移，而不是直接拒绝老文件。
 */

import type { ResumeContent, ThemeConfig } from '../types/resume';

export const EXPORT_SCHEMA = 'openresume/resume';
export const EXPORT_VERSION = 1;

export interface ResumeExportPayload {
  schema: typeof EXPORT_SCHEMA;
  version: number;
  exportedAt: string;
  title: string;
  templateId: string;
  themeConfig: ThemeConfig;
  content: ResumeContent;
}

export function buildExportPayload(input: {
  title: string;
  templateId: string;
  themeConfig: ThemeConfig;
  content: ResumeContent;
  now?: Date;
}): ResumeExportPayload {
  return {
    schema: EXPORT_SCHEMA,
    version: EXPORT_VERSION,
    exportedAt: (input.now ?? new Date()).toISOString(),
    title: input.title,
    templateId: input.templateId,
    themeConfig: input.themeConfig,
    content: input.content
  };
}

export function serializeExport(payload: ResumeExportPayload): string {
  // 2 空格缩进：JSON 导出的主要用途是「人可读的备份」，压成一行就失去意义了
  return JSON.stringify(payload, null, 2);
}

export type ImportResult =
  | { ok: true; payload: ResumeExportPayload }
  | { ok: false; error: string };

/**
 * 校验并解析导入文件。
 *
 * 只校验「能不能安全地渲染」这一层（结构、类型、模板白名单），
 * 不校验业务合理性 —— 用户导出的旧文件里可能缺某个字段，
 * 强行拒绝会让备份变成废纸。
 */
export function parseImportPayload(raw: string): ImportResult {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: '文件不是合法的 JSON' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: '文件内容不是一个简历对象' };
  }

  if (parsed.schema && parsed.schema !== EXPORT_SCHEMA) {
    return { ok: false, error: `不支持的文件类型：${String(parsed.schema)}` };
  }

  const content = parsed.content ?? parsed;
  if (!content || typeof content !== 'object' || typeof content.profile !== 'object') {
    return { ok: false, error: '缺少简历内容（content.profile）' };
  }

  const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : '导入的简历';
  const templateId = typeof parsed.templateId === 'string' ? parsed.templateId : 'classic';
  const themeConfig = parsed.themeConfig && typeof parsed.themeConfig === 'object' ? parsed.themeConfig : {};

  return {
    ok: true,
    payload: {
      schema: EXPORT_SCHEMA,
      version: typeof parsed.version === 'number' ? parsed.version : EXPORT_VERSION,
      exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
      title,
      templateId,
      themeConfig: themeConfig as ThemeConfig,
      content: content as ResumeContent
    }
  };
}

/** 下载一段文本为文件（浏览器环境） */
export function downloadText(filename: string, text: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // 立即 revoke 会让部分浏览器来不及读取；放到下一轮任务
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
