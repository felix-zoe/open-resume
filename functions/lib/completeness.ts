/**
 * 简历完整度（0–100）。
 *
 * 用途只有一个：在工作台卡片上告诉用户「这份简历还差什么」，而不是给一个
 * 看似权威的评分。因此权重按「招聘方一定会看的信息」分配，且**不判断内容质量**
 * —— 写得空洞但字段齐全，依然算 100，质量判断交给内容体检。
 *
 * 放在服务端算：列表页拿不到正文（为了不 N+1，列表只返回元数据），
 * 让服务端在查询时顺带算一个数字，比前端为每张卡片各发一次详情请求便宜得多。
 */

import type { ResumeContent } from '../../shared/types';

interface Check {
  key: string;
  weight: number;
  passed: (content: ResumeContent) => boolean;
}

const hasText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0;

const visibleItems = (mod: unknown): unknown[] => {
  const m = mod as { visible?: boolean; items?: unknown[] } | undefined;
  if (!m || m.visible === false) return [];
  return Array.isArray(m.items) ? m.items : [];
};

/** 条目里是否至少有一条带数字，用来提示「经历缺量化」 */
const hasMetric = (items: unknown[]): boolean =>
  items.some((item) => {
    const text =
      typeof item === 'string'
        ? item
        : JSON.stringify((item as { description?: unknown })?.description ?? '');
    return /\d/.test(text);
  });

const CHECKS: Check[] = [
  {
    key: 'name',
    weight: 15,
    passed: (content) => hasText(content.profile?.name)
  },
  {
    key: 'jobTitle',
    weight: 10,
    passed: (content) => hasText(content.profile?.title)
  },
  {
    key: 'contact',
    weight: 15,
    passed: (content) => hasText(content.profile?.email) || hasText(content.profile?.phone)
  },
  {
    key: 'summary',
    weight: 10,
    passed: (content) => hasText(content.profile?.summary)
  },
  {
    key: 'experience',
    weight: 20,
    passed: (content) =>
      visibleItems(content.modules?.work).length > 0 ||
      visibleItems(content.modules?.projects).length > 0
  },
  {
    key: 'education',
    weight: 10,
    passed: (content) => visibleItems(content.modules?.education).length > 0
  },
  {
    key: 'skills',
    weight: 10,
    passed: (content) => visibleItems(content.modules?.skills).length > 0
  },
  {
    key: 'metric',
    weight: 10,
    passed: (content) =>
      hasMetric(visibleItems(content.modules?.work)) ||
      hasMetric(visibleItems(content.modules?.projects))
  }
];

export interface CompletenessResult {
  /** 0–100 的整数 */
  score: number;
  /** 未通过的检查项 key，按权重降序，便于前端提示「还差什么」 */
  missing: string[];
}

export function computeCompleteness(raw: unknown): CompletenessResult {
  const content = (raw ?? {}) as ResumeContent;
  let score = 0;
  const missing: string[] = [];

  for (const check of CHECKS) {
    let passed = false;
    try {
      passed = check.passed(content);
    } catch {
      // 结构异常时按未通过处理：完整度低比「看似完整」更安全
      passed = false;
    }
    if (passed) score += check.weight;
    else missing.push(check.key);
  }

  return { score: Math.min(100, Math.round(score)), missing };
}
