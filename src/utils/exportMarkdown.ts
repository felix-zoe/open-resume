/**
 * Markdown 导出。
 *
 * 用途是「可粘贴到任何地方」的纯文本简历：招聘网站的文本框、邮件正文、
 * 笔记软件。因此刻意不做表格、不做 HTML —— 那些格式贴过去反而乱。
 */

import type { ResumeContent } from '../types/resume';
import { formatDateRange, getLabels, joinList, normalizeLocale } from '../i18n/resumeLabels';

/** 导出文档里的固定文案；英文简历里出现「个人简介」会很突兀 */
const MD_TEXT = {
  'zh-CN': { summary: '个人简介', fallbackTitle: '个人简历', link: '链接：' },
  en: { summary: 'Summary', fallbackTitle: 'Resume', link: 'Link: ' }
} as const;

/** Markdown 里需要转义的字符；简历文本常带 `*`、`_`、`[` */
function escapeMd(text: string): string {
  return String(text ?? '').replace(/([\\`*_[\]<>])/g, '\\$1');
}

/** 描述按行拆成 bullet；已经以 `-`/`•` 开头的行不重复加 */
function toBullets(description: string): string[] {
  return String(description || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line.replace(/^[-•·]\s*/, '')}`);
}

export function buildMarkdown(input: {
  title: string;
  content: ResumeContent;
}): string {
  const { title, content } = input;
  const { profile, modules, modulesOrder } = content;
  const locale = normalizeLocale(content.locale);
  const labels = getLabels(locale);
  const text = MD_TEXT[locale];
  const dateRange = (start?: string, end?: string) => formatDateRange(start, end, locale);
  const lines: string[] = [];

  // 一级标题用姓名：导出的文件被单独打开时，姓名比「我的简历」更有辨识度
  lines.push(`# ${escapeMd(profile.name || title || text.fallbackTitle)}`, '');

  const headline = [profile.title, profile.workYears, profile.location].filter(Boolean).join(' · ');
  if (headline) lines.push(`**${escapeMd(headline)}**`, '');

  const contacts = [profile.phone, profile.email, profile.github, profile.website].filter(Boolean);
  if (contacts.length) {
    lines.push(contacts.map((item) => escapeMd(String(item))).join(' · '), '');
  }

  if (profile.summary) {
    lines.push(`## ${text.summary}`, '', escapeMd(profile.summary), '');
  }

  // 每个分支取具体模块而不是 `modules[key]`：后者的类型是所有模块的联合，
  // items 的元素类型会退化成联合，逐字段访问通不过类型检查
  for (const key of modulesOrder) {
    if (key === 'work') {
      const mod = modules.work;
      if (!mod.visible || !mod.items.length) continue;
      lines.push(`## ${escapeMd(mod.title)}`, '');
      for (const item of mod.items) {
        const head = [item.company, item.position].filter(Boolean).map(escapeMd).join(' · ');
        const range = dateRange(item.startDate, item.endDate);
        lines.push(`### ${head}${range ? `${labels.parenLeft}${range}${labels.parenRight}` : ''}`, '');
        lines.push(...toBullets(item.description), '');
      }
    } else if (key === 'projects') {
      const mod = modules.projects;
      if (!mod.visible || !mod.items.length) continue;
      lines.push(`## ${escapeMd(mod.title)}`, '');
      for (const item of mod.items) {
        const head = [item.name, item.role].filter(Boolean).map(escapeMd).join(' · ');
        const range = dateRange(item.startDate, item.endDate);
        lines.push(`### ${head}${range ? `${labels.parenLeft}${range}${labels.parenRight}` : ''}`, '');
        if (item.link) lines.push(`${text.link}${escapeMd(item.link)}`, '');
        lines.push(...toBullets(item.description), '');
      }
    } else if (key === 'education') {
      const mod = modules.education;
      if (!mod.visible || !mod.items.length) continue;
      lines.push(`## ${escapeMd(mod.title)}`, '');
      for (const item of mod.items) {
        const head = [item.school, item.major, item.degree].filter(Boolean).map(escapeMd).join(' · ');
        const range = dateRange(item.startDate, item.endDate);
        lines.push(`- **${head}**${range ? `${labels.parenLeft}${range}${labels.parenRight}` : ''}`);
        if (item.description) lines.push(`  ${escapeMd(item.description)}`);
      }
      lines.push('');
    } else if (key === 'skills') {
      const mod = modules.skills;
      if (!mod.visible || !mod.items.length) continue;
      lines.push(`## ${escapeMd(mod.title)}`, '');
      lines.push(joinList(mod.items.map((item) => escapeMd(item)), locale), '');
    } else if (key === 'custom') {
      const mod = modules.custom;
      if (!mod.visible || !mod.items.length) continue;
      lines.push(`## ${escapeMd(mod.title)}`, '');
      for (const item of mod.items) {
        lines.push(...toBullets(item));
      }
      lines.push('');
    }
  }

  // 折叠多余空行，但保留段落间的单个空行
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
