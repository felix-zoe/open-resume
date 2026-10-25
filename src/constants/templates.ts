/** 内置模板 ID 的联合类型，供组件 props 收窄 */
export type TemplateId = 'classic' | 'geek' | 'modern' | 'ats';

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  shortName: string;
  tag: string;
  description: string;
  /** 预览卡的强调色 */
  accent: string;
  /** 适合的行业/岗位，驱动首页与弹窗的筛选 */
  industry: string[];
  /** 栏数：单栏对 ATS 解析器最友好 */
  columns: 1 | 2;
  /** 是否渲染头像 */
  photo: boolean;
  /** 是否通过 ATS 友好性审查（单栏、无图标、无背景色） */
  atsSafe: boolean;
}

/**
 * 内置模板的唯一元数据来源。
 * 编辑器模板弹窗、Dashboard 新建流程、首页模板预览都从这里取，
 * 避免三处各写一份导致文案/ID 漂移。
 */
export const TEMPLATES: TemplateMeta[] = [
  {
    id: 'classic',
    name: '经典通用型 (Classic)',
    shortName: '经典通用型',
    tag: 'HR 首选',
    description: '标准黑白排版与强调色点缀，居中对称，适合绝大多数行业及社招/校招。',
    accent: 'bg-primary-50',
    industry: ['通用', '金融', '教育', '制造'],
    columns: 1,
    photo: true,
    atsSafe: false
  },
  {
    id: 'geek',
    name: '极简极客型 (Geek)',
    shortName: '极简极客型',
    tag: '研发推荐',
    description: '等宽字体标识，弱化多余边线，强化技术栈标签与代码主页链接。',
    accent: 'bg-success-50',
    industry: ['研发', '数据', '运维'],
    columns: 1,
    photo: true,
    atsSafe: false
  },
  {
    id: 'modern',
    name: '现代双栏型 (Modern Sidebar)',
    shortName: '现代双栏型',
    tag: '视觉突出',
    description: '左侧侧栏展示基础技能，右侧主栏聚焦经历与项目，视觉层次鲜明。',
    accent: 'bg-warning-50',
    industry: ['产品', '运营', '设计'],
    columns: 2,
    photo: true,
    atsSafe: false
  },
  {
    id: 'ats',
    name: 'ATS 友好型 (Single Column)',
    shortName: 'ATS 友好型',
    tag: '机器可读',
    description: '单栏纯文本、无图标无头像，面向只接受 .docx/PDF 解析的招聘系统与校招网申。',
    accent: 'bg-slate-100',
    industry: ['外企', '国企', '校招', '大厂'],
    columns: 1,
    photo: false,
    atsSafe: true
  }
];

export function findTemplate(id?: string | null): TemplateMeta {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0];
}
