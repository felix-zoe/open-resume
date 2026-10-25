// 前后端共享的数据契约。
//
// 为什么单独放 `shared/`：`src/types/resume.ts` 与 `functions/` 曾经各写一份，
// 改一处忘另一处就会出现「前端存了字段、后端 schema 不认」的静默丢数据。
// 这里只放**纯类型与常量**，不 import 任何运行时代码 —— 服务端与浏览器都能引用。

export interface ResumeProfile {
  name: string;
  title: string;
  email: string;
  phone: string;
  location?: string;
  workYears?: string;
  salaryExpectation?: string;
  avatar?: string;
  showAvatar: boolean;
  github?: string;
  website?: string;
  summary?: string;
}

export interface EducationItem {
  id: string;
  school: string;
  major: string;
  degree: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface WorkItem {
  id: string;
  company: string;
  department?: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  role: string;
  startDate: string;
  endDate: string;
  link?: string;
  description: string;
}

/** 技能呈现形态：整句描述 / 标签胶囊（TPL-04） */
export const SKILL_DISPLAY_TYPES = ['sentence', 'tag'] as const;
export type SkillDisplayType = (typeof SKILL_DISPLAY_TYPES)[number];

export interface ResumeModules {
  education: {
    visible: boolean;
    title: string;
    items: EducationItem[];
  };
  work: {
    visible: boolean;
    title: string;
    items: WorkItem[];
  };
  projects: {
    visible: boolean;
    title: string;
    items: ProjectItem[];
  };
  skills: {
    visible: boolean;
    title: string;
    items: string[];
    /**
     * 技能呈现形态（TPL-04）。
     *
     * `sentence`（默认）：每条技能是一句完整描述，逐行列出，适合「熟练运用 X 解决 Y」；
     * `tag`：胶囊标签，适合「Vue3 / TypeScript / Vite」这种短词堆叠。
     * 缺省按 `sentence` 处理，历史数据不需要迁移。
     */
    type?: SkillDisplayType;
  };
  custom: {
    visible: boolean;
    title: string;
    items: string[];
  };
}

/**
 * 简历文档语言。
 *
 * 只影响**简历本身的呈现**（模块标题、日期格式、分隔符），不影响应用界面。
 * 缺省按 `zh-CN` 处理，历史数据不需要迁移。
 */
export const RESUME_LOCALES = ['zh-CN', 'en'] as const;
export type ResumeLocale = (typeof RESUME_LOCALES)[number];

export interface ResumeContent {
  profile: ResumeProfile;
  modulesOrder: (keyof ResumeModules)[];
  modules: ResumeModules;
  /** 简历语言；缺省 `zh-CN` */
  locale?: ResumeLocale;
}

export interface ThemeConfig {
  themeColor: string;       // 十六进制色值
  fontFamily: string;       // 字体样式
  fontSize: number;         // 基准字号 (px)
  lineHeight: number;       // 行高倍数
  paragraphSpacing: number; // 段落间距 (px)
  sectionSpacing: number;   // 模块间距 (px)
  pagePadding: number;      // 页面边距 (mm)
  showBorder: boolean;      // 分割线
  showSalary?: boolean;     // 是否渲染薪资期望（默认隐藏，见 TPL-07）
}

/** 服务端返回的单份简历（`GET /api/resumes/:id`） */
export interface ResumeData {
  id: string;
  title: string;
  templateId: string;
  content: ResumeContent;
  themeConfig: ThemeConfig;
  isPublic?: number;
  updatedAt?: number;
}

/** 统一响应信封 */
export interface ApiEnvelope<T = unknown> {
  code: number;
  message: string;
  data: T | null;
}

/** 模块键的合法取值，供服务端校验 modulesOrder 不塞脏值 */
export const MODULE_KEYS = ['work', 'projects', 'skills', 'education', 'custom'] as const;

/** 简历体积上限，前后端共用同一常量 */
export const MAX_RESUME_BYTES = 512 * 1024;

/**
 * 模板 id 白名单。新增模板时必须同步这里，否则服务端会拒绝保存。
 * 与 `src/constants/templates.ts` 的 `TEMPLATE_IDS` 保持一致（有单测锁定）。
 */
export const TEMPLATE_IDS = ['classic', 'geek', 'modern', 'ats'] as const;

// ---------------------------------------------------------------------------
// 投递管理（T5.1 / 4.2.9）
// ---------------------------------------------------------------------------

/**
 * 投递状态。
 *
 * 用字符串而不是数字枚举：D1 里直接读得懂，加状态不需要迁移，
 * 前端也能直接把它当 key 去查文案，不用维护两套映射。
 */
export const APPLICATION_STATUSES = [
  'saved',
  'applied',
  'interviewing',
  'offer',
  'rejected'
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface JobApplication {
  id: string;
  resumeId: string | null;
  /** 简历标题，仅在列表里关联展示；简历被删后为 null */
  resumeTitle?: string | null;
  company: string;
  position: string;
  location?: string | null;
  channel?: string | null;
  status: ApplicationStatus;
  /** 投递日期（秒）；status 为 saved 时为空 */
  appliedAt?: number | null;
  nextActionAt?: number | null;
  nextActionNote?: string | null;
  salaryRange?: string | null;
  jobUrl?: string | null;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface ApplicationStats {
  total: number;
  /** 已投递（含后续所有阶段），不含「想投」 */
  applied: number;
  interviewing: number;
  offer: number;
  rejected: number;
  /** 面试率 = 进入面试及以后 / 已投递 */
  interviewRate: number;
  /** Offer 率 = offer / 已投递 */
  offerRate: number;
  /** 7 天内需要跟进的数量 */
  dueSoon: number;
}

/** 投递状态的中文文案，前后端共用同一份，避免两边各写一套 */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  saved: '想投',
  applied: '已投递',
  interviewing: '面试中',
  offer: '已录用',
  rejected: '未通过'
};

export const APPLICATION_CHANNELS = [
  '官网',
  '内推',
  '招聘平台',
  '猎头',
  '线下'
] as const;
