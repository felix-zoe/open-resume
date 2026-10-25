/**
 * 服务端请求体校验（zod）。
 *
 * 只在服务端与导入路径使用：前端不需要为「后端会拒什么」再维护一份规则，
 * 校验失败返回 40001 + 具体字段路径，比「保存失败」可诊断得多。
 *
 * 设计取舍：所有 schema 都是**宽松**的 —— 未知字段直接剥离而不是报错。
 * 简历正文是用户自己的数据，多一个字段就整份保存失败是更糟的体验。
 */

import { z } from 'zod';
import {
  APPLICATION_STATUSES,
  MODULE_KEYS,
  RESUME_LOCALES,
  SKILL_DISPLAY_TYPES,
  TEMPLATE_IDS
} from '../../shared/types';

const shortText = (max: number) => z.string().trim().max(max);
const dateText = z.string().trim().max(20);

/** 头像可能是 R2 相对路径、data:URL 或历史外链；长度上限防止把正文撑爆 */
const avatarText = z.string().max(700_000);

export const profileSchema = z
  .object({
    name: shortText(60),
    title: shortText(60),
    email: shortText(120),
    phone: shortText(40),
    location: shortText(80).optional(),
    workYears: shortText(20).optional(),
    salaryExpectation: shortText(40).optional(),
    avatar: avatarText.optional(),
    showAvatar: z.boolean(),
    github: shortText(300).optional(),
    website: shortText(300).optional(),
    summary: z.string().max(4000).optional()
  })
  .partial()
  .passthrough();

const workItemSchema = z
  .object({
    id: shortText(64),
    company: shortText(120),
    department: shortText(120).optional(),
    position: shortText(120),
    startDate: dateText,
    endDate: dateText,
    description: z.string().max(8000)
  })
  .partial()
  .passthrough();

const projectItemSchema = z
  .object({
    id: shortText(64),
    name: shortText(120),
    role: shortText(120),
    startDate: dateText,
    endDate: dateText,
    link: shortText(500).optional(),
    description: z.string().max(8000)
  })
  .partial()
  .passthrough();

const educationItemSchema = z
  .object({
    id: shortText(64),
    school: shortText(120),
    major: shortText(120),
    degree: shortText(60),
    startDate: dateText,
    endDate: dateText,
    description: z.string().max(4000).optional()
  })
  .partial()
  .passthrough();

const moduleSection = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      visible: z.boolean(),
      title: shortText(40),
      items: z.array(item).max(60)
    })
    .partial()
    .passthrough();

export const resumeContentSchema = z
  .object({
    profile: profileSchema.optional(),
    locale: z.enum(RESUME_LOCALES).optional(),
    modulesOrder: z.array(z.enum(MODULE_KEYS)).max(10).optional(),
    modules: z
      .object({
        education: moduleSection(educationItemSchema).optional(),
        work: moduleSection(workItemSchema).optional(),
        projects: moduleSection(projectItemSchema).optional(),
        skills: moduleSection(z.string().max(200))
          .extend({ type: z.enum(SKILL_DISPLAY_TYPES).optional() })
          .optional(),
        custom: moduleSection(z.string().max(2000)).optional()
      })
      .passthrough()
      .optional()
  })
  .passthrough();

export const themeConfigSchema = z
  .object({
    themeColor: z.string().max(40),
    fontFamily: z.string().max(200),
    fontSize: z.number().min(8).max(24),
    lineHeight: z.number().min(1).max(3),
    paragraphSpacing: z.number().min(0).max(80),
    sectionSpacing: z.number().min(0).max(80),
    pagePadding: z.number().min(0).max(40),
    showBorder: z.boolean(),
    showSalary: z.boolean().optional()
  })
  .partial()
  .passthrough();

/** `PUT /api/resumes/:id` 的请求体 */
export const saveResumeSchema = z
  .object({
    title: shortText(100).optional(),
    templateId: z.enum(TEMPLATE_IDS).optional(),
    content: resumeContentSchema.optional(),
    themeConfig: themeConfigSchema.optional(),
    isPublic: z.union([z.number(), z.boolean()]).optional()
  })
  .passthrough();

/** `POST /api/resumes` 的请求体 */
export const createResumeSchema = saveResumeSchema;

export const registerSchema = z.object({
  email: z.string(),
  password: z.string(),
  nickname: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string(),
  password: z.string()
});

export const shareLinkSchema = z
  .object({
    ttl: z.enum(['7d', '30d', 'permanent']).optional(),
    password: z.string().optional(),
    label: z.string().optional(),
    allowDownload: z.boolean().optional(),
    maskContact: z.boolean().optional()
  })
  .passthrough();

/** 投递记录的时间字段：接受秒级时间戳或 null，0 视为「没填」 */
const optionalTimestamp = z.union([z.number().int(), z.null()]).optional();

export const jobApplicationSchema = z
  .object({
    company: shortText(120).optional(),
    position: shortText(120).optional(),
    location: shortText(80).optional(),
    channel: shortText(40).optional(),
    status: z.enum(APPLICATION_STATUSES).optional(),
    resumeId: z.union([z.string().max(64), z.null()]).optional(),
    appliedAt: optionalTimestamp,
    nextActionAt: optionalTimestamp,
    nextActionNote: shortText(200).optional(),
    salaryRange: shortText(60).optional(),
    jobUrl: shortText(500).optional(),
    notes: z.string().max(4000).optional()
  })
  .passthrough();

/** 创建时必须给公司名与岗位：没有这两个字段的记录在列表里无法辨认 */
export const createJobApplicationSchema = jobApplicationSchema.extend({
  company: z.string().trim().min(1).max(120),
  position: z.string().trim().min(1).max(120)
});

export type SaveResumeInput = z.infer<typeof saveResumeSchema>;
export type ShareLinkInput = z.infer<typeof shareLinkSchema>;
export type JobApplicationInput = z.infer<typeof jobApplicationSchema>;

export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * 校验并返回结构化错误。
 *
 * 只取前 3 条：错误提示要能一眼看完，用户改完再提交即可，
 * 一次列 20 条反而不知道从哪下手。
 */
export function validate<T>(
  schema: z.ZodType<T>,
  input: unknown
): { ok: true; data: T } | { ok: false; issues: ValidationIssue[] } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const issues: ValidationIssue[] = result.error.issues.slice(0, 3).map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message
  }));
  return { ok: false, issues };
}

/** 把校验结果拼成一句可展示的文案，如「content.modules.work.items: 数组最多 60 项」 */
export function issuesToMessage(issues: ValidationIssue[]): string {
  const detail = issues.map((issue) => `${issue.path}: ${issue.message}`).join('；');
  return `请求参数不合法（${detail}）`;
}
