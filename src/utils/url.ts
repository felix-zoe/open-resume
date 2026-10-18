/**
 * 外链安全校验。
 *
 * 简历中的 GitHub / 作品集 / 项目链接全部由用户输入，且会渲染到公开分享页。
 * 直接绑定 `:href` 会让 `javascript:` 协议在点击时执行脚本（存储型 XSS），
 * 因此所有外链必须先经过本函数。
 *
 * 规则：
 * - 空值 / 非字符串 → null（调用方渲染纯文本）
 * - 仅允许 http / https
 * - 无协议且形如域名（含点）时补 https://
 * - 拒绝协议相对地址 `//evil.com`（避免继承页面协议绕过校验）
 */
export function safeUrl(raw?: string | null): string | null {
  if (typeof raw !== 'string') return null;

  const value = raw.trim();
  if (!value) return null;

  // 协议相对地址：语义不明确，一律拒绝
  if (value.startsWith('//')) return null;

  // 拒绝控制字符与空白（可被用于拆分协议，如 "java\nscript:"）
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return null;

  let candidate = value;
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);

  if (!hasScheme) {
    // 形如 example.com/path 的裸域名才补协议；否则视为无效
    if (!/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)+([/?#].*)?$/.test(value)) return null;
    candidate = `https://${value}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.hostname) return null;

  return parsed.href;
}

/** 渲染用：是否可安全作为链接 */
export function isSafeUrl(raw?: string | null): boolean {
  return safeUrl(raw) !== null;
}
