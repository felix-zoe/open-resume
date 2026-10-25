/**
 * 简历文档的多语言文案。
 *
 * 范围刻意收窄到**简历文档本身**（模块标题、固定标签、日期与分隔符），
 * 不含应用界面。理由：英文简历的使用者是「投外企的中国求职者」——
 * 简历要给英文 HR 看，界面他们看得懂中文。把 892 行界面文案一起翻，
 * 成本是这里的十倍，收益却是零。
 *
 * 界面多语言另立任务（见 docs/优化执行状态.md 的 M5 记录）。
 */

import type { ResumeModules } from '../../shared/types';
import { RESUME_LOCALES, type ResumeLocale } from '../../shared/types';

export type ModuleKey = keyof ResumeModules;

/** 各语言的默认模块标题。用户改过标题后不再自动覆盖（见 resolveModuleTitle） */
export const MODULE_TITLES: Record<ResumeLocale, Record<ModuleKey, string>> = {
  'zh-CN': {
    work: '工作经历',
    projects: '项目经历',
    skills: '专业技能',
    education: '教育背景',
    custom: '自定义模块'
  },
  en: {
    work: 'Work Experience',
    projects: 'Projects',
    skills: 'Skills',
    education: 'Education',
    custom: 'Additional'
  }
};

/** Geek 模板的英文副标签；中文界面下也保留（它是版式的一部分，不是语言） */
export const MODULE_CODE_LABELS: Record<ModuleKey, string> = {
  work: 'EXPERIENCE',
  projects: 'PROJECTS',
  skills: 'SKILLS',
  education: 'EDUCATION',
  custom: 'CUSTOM'
};

export interface ResumeFixedLabels {
  /** 姓名为空时的占位 */
  name: string;
  /** 求职意向为空时的占位 */
  jobTitle: string;
  /** 作品集 / 个人主页链接文字 */
  portfolio: string;
  /** 项目条目的「演示链接」 */
  demoLink: string;
  /** 结束时间为「至今」时的写法 */
  present: string;
  /** 技能列表分隔符（中文用顿号，英文用逗号） */
  listSeparator: string;
  /** 日期区间分隔符 */
  dateSeparator: string;
  /** 包裹补充信息（部门/学历/角色）的括号 */
  parenLeft: string;
  parenRight: string;
}

export const RESUME_LABELS: Record<ResumeLocale, ResumeFixedLabels> = {
  'zh-CN': {
    name: '姓名',
    jobTitle: '求职意向',
    portfolio: '作品集',
    demoLink: '演示链接',
    present: '至今',
    listSeparator: '、',
    // 用 en dash 而不是连字符：与 ATS 模板、Markdown 导出原有的写法一致
    dateSeparator: ' – ',
    parenLeft: '（',
    parenRight: '）'
  },
  en: {
    name: 'Your Name',
    jobTitle: 'Target Role',
    portfolio: 'Portfolio',
    demoLink: 'Demo',
    present: 'Present',
    listSeparator: ', ',
    dateSeparator: ' – ',
    parenLeft: ' (',
    parenRight: ')'
  }
};

/** 非法或缺失的 locale 一律回退中文，避免历史数据渲染出空白 */
export function normalizeLocale(value: unknown): ResumeLocale {
  return typeof value === 'string' && (RESUME_LOCALES as readonly string[]).includes(value)
    ? (value as ResumeLocale)
    : 'zh-CN';
}

export function getLabels(locale: unknown): ResumeFixedLabels {
  return RESUME_LABELS[normalizeLocale(locale)];
}

/**
 * 模块标题。
 *
 * 只替换「仍是某个语言的默认值」的标题：用户手写成「核心项目」或
 * 「Selected Work」后切换语言，不该被覆盖。这是把用户意图和数据默认值
 * 区分开的唯一可靠办法——数据里没有「是否改过」的标记。
 */
export function resolveModuleTitle(
  key: ModuleKey,
  title: string | undefined,
  locale: unknown
): string {
  const current = (title ?? '').trim();
  const target = normalizeLocale(locale);
  if (!current) return MODULE_TITLES[target][key];

  const isDefaultOfAnyLocale = RESUME_LOCALES.some(
    (candidate) => MODULE_TITLES[candidate][key] === current
  );
  return isDefaultOfAnyLocale ? MODULE_TITLES[target][key] : current;
}

/** 批量把「仍是默认值」的模块标题切到目标语言，返回新的 modules 副本 */
export function localizeModuleTitles<T extends Record<string, { title?: string }>>(
  modules: T,
  locale: unknown
): T {
  const next: Record<string, { title?: string }> = { ...modules };
  for (const key of Object.keys(next)) {
    const section = next[key];
    if (!section) continue;
    next[key] = {
      ...section,
      title: resolveModuleTitle(key as ModuleKey, section.title, locale)
    };
  }
  return next as T;
}

/** 把 `2022.07` 渲染成目标语言习惯的日期；「至今」按 locale 替换 */
export function formatDate(value: string | undefined, locale: unknown): string {
  const text = (value ?? '').trim();
  if (!text) return '';
  const labels = getLabels(locale);
  if (text === RESUME_LABELS['zh-CN'].present || text === RESUME_LABELS.en.present) {
    return labels.present;
  }
  // `YYYY.MM` 在英文里写成 `MM/YYYY`，其余格式原样返回（历史数据可能是 `2022年7月`）
  const match = /^(\d{4})\.(\d{2})$/.exec(text);
  if (match && normalizeLocale(locale) === 'en') {
    return `${match[2]}/${match[1]}`;
  }
  return text;
}

/** 日期区间，如 `2022.07 - 至今` / `07/2022 – Present` */
export function formatDateRange(start: string | undefined, end: string | undefined, locale: unknown): string {
  const labels = getLabels(locale);
  const left = formatDate(start, locale);
  const right = formatDate(end, locale);
  if (!left && !right) return '';
  if (!right) return left;
  if (!left) return right;
  return `${left}${labels.dateSeparator}${right}`;
}

/** 用括号包裹补充信息；中文全角、英文半角带前导空格 */
export function wrapParen(text: string | undefined, locale: unknown): string {
  const value = (text ?? '').trim();
  if (!value) return '';
  const labels = getLabels(locale);
  return `${labels.parenLeft}${value}${labels.parenRight}`;
}

/** 技能/自定义模块的列表拼接 */
export function joinList(items: string[], locale: unknown): string {
  return items.filter(Boolean).join(getLabels(locale).listSeparator);
}
