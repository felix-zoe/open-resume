/**
 * 导出文件名统一规则：`姓名_求职意向_年限`。
 *
 * HR 下载一堆简历后全叫「简历.pdf」是最常见的抱怨，这里把三个最有辨识度的
 * 信息拼进文件名。缺失的段直接跳过，不留下多余的下划线。
 */

const ILLEGAL = /[\\/:*?"<>|\r\n\t]/g;

function clean(value: string | undefined | null, max = 24): string {
  return String(value ?? '')
    .replace(ILLEGAL, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function buildExportFilename(input: {
  name?: string;
  title?: string;
  workYears?: string;
  fallback?: string;
  ext: string;
}): string {
  const parts = [
    clean(input.name),
    clean(input.title),
    clean(input.workYears, 12)
  ].filter(Boolean);

  const base = parts.length ? parts.join('_') : clean(input.fallback) || '我的简历';
  const ext = input.ext.replace(/^\./, '');
  return `${base}.${ext}`;
}
