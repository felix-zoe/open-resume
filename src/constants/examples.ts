/**
 * 示例页数据（4.2.12）。
 *
 * 每个示例都是一个可被搜索引擎索引的真实页面：标题、描述、正文都是静态文案，
 * 正文里挂的是**真实模板组件**渲染出来的简历，不是截图。
 *
 * 为什么不做 6 个完全独立的 HTML：维护成本会翻 6 倍，而内容差异其实只有
 * 「岗位名 + 强调的三条要点 + 模板」。用一份数据驱动，新增岗位只是加一条。
 *
 * 数据本体放在 `examples.data.json` 而不是这里：构建后的预渲染脚本
 * （`scripts/prerender.mjs`）跑在 Node 里，读不了 TS，读 JSON 可以直接 require。
 * 两边共用同一份文件，才不会出现「页面有、head 里没有」。
 */

import type { ResumeContent } from '../types/resume';
import type { TemplateId } from './templates';
import { DEFAULT_EN_RESUME_CONTENT, DEFAULT_RESUME_CONTENT } from '../utils/presets';
import rawExamples from './examples.data.json';

export interface ResumeExample {
  /** URL 片段：`/examples/:slug` */
  slug: string;
  /** 页面 h1 与列表标题 */
  name: string;
  /** SEO 标题（不含站点名） */
  seoTitle: string;
  /** SEO 描述，控制在一句话内 */
  description: string;
  templateId: TemplateId;
  /** 简历语言：外企场景用英文示例 */
  locale: 'zh-CN' | 'en';
  /** 示例里展示的求职意向 */
  jobTitle: string;
  /** 这个岗位最该强调的三点 */
  highlights: string[];
  /** 这个岗位的写作建议 */
  tips: string[];
}

export const RESUME_EXAMPLES = rawExamples.examples as ResumeExample[];

export function findExample(slug: string): ResumeExample | undefined {
  return RESUME_EXAMPLES.find((example) => example.slug === slug);
}

/**
 * 为示例页生成可渲染的简历内容。
 *
 * 在默认范文的基础上改「求职意向」，让每个岗位的示例一眼看出差别，
 * 又不必维护 6 份完整数据。
 */
export function buildExampleContent(example: ResumeExample): ResumeContent {
  const base = example.locale === 'en' ? DEFAULT_EN_RESUME_CONTENT : DEFAULT_RESUME_CONTENT;
  const content: ResumeContent = JSON.parse(JSON.stringify(base));
  content.profile.title = example.jobTitle;
  return content;
}
