/**
 * UI 原语的公共工具。
 */

/** 合并 class，过滤空值 */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
