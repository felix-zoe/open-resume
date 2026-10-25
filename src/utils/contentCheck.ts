/**
 * 逐条 bullet 的内容检查。
 *
 * 与 `validation.ts` 的 `checkResumeContent` 分工不同：
 * · 后者是「导出前整体体检」，按模块给一条结论，不逐条罗列；
 * · 这里是「编辑器里的检查面板」，定位到具体条目、具体行，供用户逐条修。
 *
 * 所有规则都是启发式的，**永远只提示不阻断** —— 一句没有数字的描述
 * 未必是坏描述（比如「负责团队招聘」），用户比规则更清楚该不该改。
 */

import type { ResumeContent } from '../types/resume';
import { findPlaceholders } from './validation';

export type BulletIssueKind =
  | 'no-metric'
  | 'weak-verb'
  | 'too-long'
  | 'placeholder'
  | 'empty-verb'
  | 'vague';

export interface BulletIssue {
  kind: BulletIssueKind;
  /** 出问题的模块与条目，供 UI 定位 */
  module: 'work' | 'projects';
  itemId: string;
  /** 条目内的第几行（0 起） */
  lineIndex: number;
  /** 该行原文 */
  text: string;
  message: string;
}

/** 弱动词：只描述「做了什么」，没有「做出什么结果」 */
const WEAK_VERBS = ['负责', '参与', '协助', '配合', '帮助', '了解', '熟悉', '接触'];

/** 空洞词：说了等于没说 */
const VAGUE_PHRASES = ['相关工作', '各种工作', '等事项', '若干', '一些', '大量工作'];

/** 量化信号：数字 + 单位/百分比/倍数 */
const METRIC_PATTERN = /\d+(?:\.\d+)?\s*(?:%|％|倍|万|千|亿|人|次|个|项|条|天|小时|ms|s\b|k\b|K\b|\+|＋)/;

/** 单行建议上限（按中文字符宽度估算，约 2 行 A4 正文） */
export const MAX_BULLET_LENGTH = 60;

export interface ContentCheckOptions {
  /** 关闭某类检查，供设置面板使用 */
  enabled?: Partial<Record<BulletIssueKind, boolean>>;
}

function lineIssues(
  module: 'work' | 'projects',
  itemId: string,
  line: string,
  lineIndex: number
): BulletIssue[] {
  const text = line.replace(/^[-•·*]\s*/, '').trim();
  if (!text) return [];

  const issues: BulletIssue[] = [];

  // 1. 占位符未替换 —— 优先级最高，导出后直接露馅
  const placeholders = findPlaceholders(text);
  if (placeholders.length) {
    issues.push({
      kind: 'placeholder',
      module,
      itemId,
      lineIndex,
      text,
      message: `占位符「${placeholders[0].text}」还没替换`
    });
  }

  // 2. 弱动词开头：只在前 6 个字里找，避免把正文中段的「配合」误判
  const head = text.slice(0, 6);
  const weak = WEAK_VERBS.find((verb) => head.startsWith(verb) || head.includes(verb));
  if (weak) {
    issues.push({
      kind: 'weak-verb',
      module,
      itemId,
      lineIndex,
      text,
      message: `「${weak}」偏描述过程，可换成「主导 / 搭建 / 重构」这类有结果的动词`
    });
  }

  // 3. 缺少量化数据
  if (!METRIC_PATTERN.test(text)) {
    issues.push({
      kind: 'no-metric',
      module,
      itemId,
      lineIndex,
      text,
      message: '没有具体数字，建议补充规模、耗时或提升幅度'
    });
  }

  // 4. 过长：手机上会被截成 3 行以上，HR 通常只扫前两行
  if (text.length > MAX_BULLET_LENGTH) {
    issues.push({
      kind: 'too-long',
      module,
      itemId,
      lineIndex,
      text,
      message: `超过 ${MAX_BULLET_LENGTH} 字，建议拆成两条或删掉修饰`
    });
  }

  // 5. 空洞表述
  const vague = VAGUE_PHRASES.find((phrase) => text.includes(phrase));
  if (vague) {
    issues.push({
      kind: 'vague',
      module,
      itemId,
      lineIndex,
      text,
      message: `「${vague}」信息量低，建议直接写清做了什么`
    });
  }

  return issues;
}

/** 扫描所有工作/项目条目，返回逐行问题 */
export function checkBullets(
  content: ResumeContent,
  options: ContentCheckOptions = {}
): BulletIssue[] {
  const enabled = options.enabled ?? {};
  const all: BulletIssue[] = [];

  const collect = (module: 'work' | 'projects', items: Array<{ id: string; description: string }>) => {
    for (const item of items) {
      const lines = String(item.description || '').split('\n');
      lines.forEach((line, index) => {
        all.push(...lineIssues(module, item.id, line, index));
      });
    }
  };

  collect('work', content.modules?.work?.items ?? []);
  collect('projects', content.modules?.projects?.items ?? []);

  return all.filter((issue) => enabled[issue.kind] !== false);
}

/** 按类型汇总，供面板显示「N 处待改」 */
export function summarizeIssues(issues: BulletIssue[]): Record<BulletIssueKind, number> {
  const summary: Record<BulletIssueKind, number> = {
    'no-metric': 0,
    'weak-verb': 0,
    'too-long': 0,
    placeholder: 0,
    'empty-verb': 0,
    vague: 0
  };
  for (const issue of issues) summary[issue.kind] += 1;
  return summary;
}

/** 弱动词替换建议（只给建议，不自动改 —— 改写简历是用户的决定） */
export const WEAK_VERB_SUGGESTIONS: Record<string, string[]> = {
  负责: ['主导', '搭建', '牵头'],
  参与: ['主导', '推动', '设计并实现'],
  协助: ['协同', '支撑', '配合完成'],
  配合: ['协同', '推动'],
  帮助: ['推动', '支撑'],
  了解: ['掌握', '实践'],
  熟悉: ['熟练掌握', '深入实践'],
  接触: ['实践', '落地']
};
