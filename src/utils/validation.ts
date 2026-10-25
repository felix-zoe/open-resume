/**
 * 字段校验与内容体检。
 *
 * 编辑器里的错误文案分散在各 Section 里时，同一条规则会被写成三四种说法
 * （「手机号不正确」「请输入有效手机号」「手机号格式有误」）。这里统一成
 * 纯函数，既让文案一致，也便于单测锁定。
 */

export interface ValidationResult {
  valid: boolean;
  message: string;
}

const OK: ValidationResult = { valid: true, message: '' };

/**
 * 中国大陆手机号：1 开头，第二位 3-9，共 11 位。
 * 允许用户输入带空格/短横线的形式，校验前统一去掉分隔符。
 */
export function validatePhone(value: string): ValidationResult {
  const raw = (value || '').trim();
  if (!raw) return { valid: false, message: '请填写联系电话' };
  const digits = raw.replace(/[\s-]/g, '');
  if (!/^1[3-9]\d{9}$/.test(digits)) {
    return { valid: false, message: '请输入 11 位手机号，如 13800138000' };
  }
  return OK;
}

/** 邮箱：不做 RFC 全量校验，只拦明显错误（无 @、无域名、含空格） */
export function validateEmail(value: string): ValidationResult {
  const raw = (value || '').trim();
  if (!raw) return { valid: false, message: '请填写电子邮箱' };
  if (/\s/.test(raw)) return { valid: false, message: '邮箱中不能包含空格' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw)) {
    return { valid: false, message: '请输入有效邮箱，如 name@example.com' };
  }
  return OK;
}

/**
 * URL 校验：允许省略协议的裸域名（模板渲染时会补 https）。
 * 只放行 http/https —— `javascript:` 这类协议必须在录入阶段就拦下，
 * 而不是等渲染时再靠 safeUrl 兜底。
 */
export function validateUrl(value: string): ValidationResult {
  const raw = (value || '').trim();
  if (!raw) return OK; // 选填字段，空值合法
  if (/^(javascript|data|vbscript):/i.test(raw)) {
    return { valid: false, message: '不支持该协议，请填写 http(s) 链接' };
  }
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (!url.hostname.includes('.')) {
      return { valid: false, message: '请输入完整域名，如 example.com' };
    }
    return OK;
  } catch {
    return { valid: false, message: '请输入有效链接，如 https://example.com' };
  }
}

/**
 * 占位符残留检测。
 *
 * 用户从模板/示例里复制句式时经常忘记替换 `[核心模块]`、`XX%`、`xxx`，
 * 导出后直接出现在简历上。这里只做提示，不阻塞任何操作。
 */
const PLACEHOLDER_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\[[^\]]{1,30}\]/g, label: '方括号占位符' },
  { regex: /\bXX+\b/g, label: 'XX 占位符' },
  { regex: /\bxxx+\b/gi, label: 'xxx 占位符' },
  { regex: /（[^）]{0,4}(?:填写|替换)[^）]{0,6}）/g, label: '填写提示' },
  { regex: /【[^】]{0,20}】/g, label: '中文方括号占位符' }
];

export interface PlaceholderHit {
  text: string;
  label: string;
}

/** 扫描一段文本里的占位符，返回命中项（去重） */
export function findPlaceholders(text: string): PlaceholderHit[] {
  if (!text) return [];
  const hits: PlaceholderHit[] = [];
  const seen = new Set<string>();
  for (const { regex, label } of PLACEHOLDER_PATTERNS) {
    // 每个 pattern 独立重置 lastIndex，避免带 g 的正则在多次调用间串状态
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const key = `${label}:${match[0]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ text: match[0], label });
      if (hits.length >= 20) return hits;
    }
  }
  return hits;
}

export interface ContentIssue {
  /** 出问题的模块，用于在 UI 上定位 */
  module: 'profile' | 'work' | 'projects' | 'education' | 'skills' | 'custom';
  message: string;
  severity: 'error' | 'warning';
}

/**
 * 导出前的整体体检。
 *
 * 刻意不阻塞导出：用户可以带着提示继续导出——把「能不能导出」的权力
 * 交给用户，而不是让一个启发式规则替他决定。
 */
export function checkResumeContent(content: any): ContentIssue[] {
  const issues: ContentIssue[] = [];
  if (!content || typeof content !== 'object') return issues;

  const profile = content.profile ?? {};
  if (!String(profile.name || '').trim()) {
    issues.push({ module: 'profile', message: '缺少姓名', severity: 'error' });
  }
  if (!String(profile.phone || '').trim()) {
    issues.push({ module: 'profile', message: '缺少联系电话', severity: 'error' });
  } else if (!validatePhone(profile.phone).valid) {
    issues.push({ module: 'profile', message: '联系电话格式不正确', severity: 'warning' });
  }
  if (!String(profile.email || '').trim()) {
    issues.push({ module: 'profile', message: '缺少电子邮箱', severity: 'error' });
  } else if (!validateEmail(profile.email).valid) {
    issues.push({ module: 'profile', message: '电子邮箱格式不正确', severity: 'warning' });
  }

  // 占位符残留：逐模块扫描，命中一次即提示（不逐条罗列，避免刷屏）
  const modules = content.modules ?? {};
  for (const [key, mod] of Object.entries<any>(modules)) {
    if (!mod?.visible) continue;
    const texts: string[] = [];
    if (Array.isArray(mod.items)) {
      for (const item of mod.items) {
        if (typeof item === 'string') texts.push(item);
        else if (item && typeof item === 'object') {
          for (const value of Object.values(item)) {
            if (typeof value === 'string') texts.push(value);
          }
        }
      }
    }
    const hits = texts.flatMap((text) => findPlaceholders(text));
    if (hits.length) {
      issues.push({
        module: key as ContentIssue['module'],
        message: `检测到 ${hits.length} 处占位符未替换（如「${hits[0].text}」）`,
        severity: 'warning'
      });
    }
  }

  // 总结为空时的温和提示：不影响导出，但值得补
  if (!String(profile.summary || '').trim()) {
    issues.push({ module: 'profile', message: '建议补一句个人总结', severity: 'warning' });
  }

  return issues;
}
