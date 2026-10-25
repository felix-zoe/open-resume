/**
 * 从纯文本 / Markdown 简历中还原结构化内容。
 *
 * 这是个「尽力而为」的解析器：用户粘贴的来源五花八门（Word 复制、招聘网站
 * 导出的 txt、自己写的 md），不可能百分百还原。因此原则是：
 * · 能识别多少写多少，识别不出的内容放进「自定义模块」而不是丢弃；
 * · 解析结果先给用户预览确认，确认后才写进 store（见 ImportDialog）。
 */

import type { ResumeContent, ResumeProfile } from '../types/resume';

/** 章节标题关键词 → 模块键 */
const SECTION_PATTERNS: Array<{ key: keyof ResumeContent['modules']; pattern: RegExp }> = [
  { key: 'work', pattern: /^(工作经历|工作经验|职业经历|任职经历|experience|work experience)/i },
  { key: 'projects', pattern: /^(项目经历|项目经验|projects?|project experience)/i },
  { key: 'education', pattern: /^(教育背景|教育经历|学历|education)/i },
  { key: 'skills', pattern: /^(专业技能|技能|技术栈|skills?|tech stack)/i },
  { key: 'custom', pattern: /^(自我评价|个人简介|获奖|证书|荣誉|summary|about)/i }
];

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.]+/;
const PHONE_PATTERN = /1[3-9]\d{9}/;
const URL_PATTERN = /https?:\/\/[^\s，,；;）)]+/;

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function detectSection(line: string): keyof ResumeContent['modules'] | null {
  // 去掉 Markdown 标题符号与末尾冒号
  const clean = line.replace(/^#{1,6}\s*/, '').replace(/[：:]\s*$/, '').trim();
  if (!clean || clean.length > 20) return null;
  for (const { key, pattern } of SECTION_PATTERNS) {
    if (pattern.test(clean)) return key;
  }
  return null;
}

export interface TextImportResult {
  content: ResumeContent;
  /** 识别到的章节数量，用于提示「只识别到 N 段」 */
  sectionCount: number;
  /** 无法归入任何章节的非空行数 */
  unparsedLines: number;
}

/**
 * 解析纯文本。
 *
 * `defaults` 提供一份合法的空骨架 —— 解析器只负责填空，
 * 不负责补齐 `showAvatar` 这类模板需要的字段（否则渲染会崩）。
 */
export function parsePlainText(text: string, defaults: ResumeContent): TextImportResult {
  const lines = String(text || '').split(/\r?\n/);
  const content: ResumeContent = JSON.parse(JSON.stringify(defaults));

  // 清空示例数据，只保留结构
  content.modules.work.items = [];
  content.modules.projects.items = [];
  content.modules.education.items = [];
  content.modules.skills.items = [];
  content.modules.custom.items = [];

  let currentSection: keyof ResumeContent['modules'] | null = null;
  let sectionCount = 0;
  let unparsedLines = 0;
  const headerLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const section = detectSection(line);
    if (section) {
      currentSection = section;
      sectionCount += 1;
      continue;
    }

    if (!currentSection) {
      headerLines.push(line);
      continue;
    }

    if (currentSection === 'skills') {
      // 技能常见写法：一行一个、顿号分隔、逗号分隔
      content.modules.skills.items.push(
        ...line
          .replace(/^[-•·*]\s*/, '')
          .split(/[、,，/|]/)
          .map((item) => item.trim())
          .filter(Boolean)
      );
      continue;
    }

    if (currentSection === 'custom') {
      content.modules.custom.items.push(line.replace(/^[-•·*]\s*/, ''));
      continue;
    }

    // 工作 / 项目 / 教育：以「行首带年份」区分条目与描述行
    const bullet = line.replace(/^[-•·*]\s*/, '');
    const isNewEntry = /\d{4}[.\-/年]/.test(bullet) && bullet.length < 60;

    if (currentSection === 'work') {
      const last = content.modules.work.items[content.modules.work.items.length - 1];
      if (isNewEntry || !last) {
        content.modules.work.items.push({
          id: newId('w'),
          company: bullet,
          position: '',
          startDate: '',
          endDate: '',
          description: ''
        });
      } else {
        last.description = last.description ? `${last.description}\n${bullet}` : bullet;
      }
    } else if (currentSection === 'projects') {
      const last = content.modules.projects.items[content.modules.projects.items.length - 1];
      if (isNewEntry || !last) {
        content.modules.projects.items.push({
          id: newId('p'),
          name: bullet,
          role: '',
          startDate: '',
          endDate: '',
          description: ''
        });
      } else {
        last.description = last.description ? `${last.description}\n${bullet}` : bullet;
      }
    } else if (currentSection === 'education') {
      const last = content.modules.education.items[content.modules.education.items.length - 1];
      if (isNewEntry || !last) {
        content.modules.education.items.push({
          id: newId('e'),
          school: bullet,
          major: '',
          degree: '',
          startDate: '',
          endDate: '',
          description: ''
        });
      } else {
        last.description = last.description ? `${last.description}\n${bullet}` : bullet;
      }
    }
  }

  // 头部：第一行通常是姓名，其余按正则抽取联系方式
  const headerText = headerLines.join('\n');
  const profile: ResumeProfile = content.profile;
  profile.name = headerLines[0]?.replace(/^#\s*/, '').slice(0, 30) || profile.name;
  profile.email = EMAIL_PATTERN.exec(headerText)?.[0] || '';
  profile.phone = PHONE_PATTERN.exec(headerText)?.[0] || '';
  profile.website = URL_PATTERN.exec(headerText)?.[0] || '';
  profile.github = '';
  profile.summary = '';

  // 第二行若是短句，当作求职意向
  const second = headerLines[1];
  if (second && second.length <= 40 && !EMAIL_PATTERN.test(second) && !PHONE_PATTERN.test(second)) {
    profile.title = second;
  } else {
    profile.title = '';
  }

  unparsedLines = headerLines.length > 2 ? headerLines.length - 2 : 0;

  return { content, sectionCount, unparsedLines };
}

/**
 * 解析 Markdown。
 *
 * 与纯文本的区别：Markdown 的 `##` 标题是强章节信号，比关键词匹配可靠，
 * 因此优先按层级切分；其余交给纯文本解析器处理。
 */
export function parseMarkdown(text: string, defaults: ResumeContent): TextImportResult {
  // 把 `## 标题` 归一成纯文本章节行，后续逻辑与纯文本完全一致
  const normalized = String(text || '').replace(/^#{1,6}\s+/gm, '');
  return parsePlainText(normalized, defaults);
}
