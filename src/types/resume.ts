// 简历数据类型 —— 单一来源在 `shared/types.ts`，前后端共用同一份定义。
//
// 本文件保留为 re-export：`src/` 内既有 import 路径（`../types/resume`）无需改动，
// 而新增字段只需改 shared/ 一处，避免「前端存了、后端不认」的静默丢数据。

export type {
  ResumeProfile,
  EducationItem,
  WorkItem,
  ProjectItem,
  ResumeModules,
  ResumeContent,
  ThemeConfig,
  ResumeData,
  ApiEnvelope
} from '../../shared/types';

export { MODULE_KEYS, MAX_RESUME_BYTES, TEMPLATE_IDS } from '../../shared/types';
