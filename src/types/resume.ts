// 简历数据类型定义契约

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
  };
  custom: {
    visible: boolean;
    title: string;
    items: string[];
  };
}

export interface ResumeContent {
  profile: ResumeProfile;
  modulesOrder: (keyof ResumeModules)[];
  modules: ResumeModules;
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
}

export interface ResumeData {
  id: string;
  title: string;
  templateId: string;
  content: ResumeContent;
  themeConfig: ThemeConfig;
  isPublic?: number;
  updatedAt?: number;
}
