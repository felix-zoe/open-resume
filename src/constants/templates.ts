export interface TemplateMeta {
  id: string;
  name: string;
  shortName: string;
  tag: string;
  description: string;
  /** 预览卡的强调色 */
  accent: string;
}

/**
 * 三套内置模板的唯一元数据来源。
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
    accent: 'bg-primary-50'
  },
  {
    id: 'geek',
    name: '极简极客型 (Geek)',
    shortName: '极简极客型',
    tag: '研发推荐',
    description: '等宽字体标识，弱化多余边线，强化技术栈标签与代码主页链接。',
    accent: 'bg-success-50'
  },
  {
    id: 'modern',
    name: '现代双栏型 (Modern Sidebar)',
    shortName: '现代双栏型',
    tag: '视觉突出',
    description: '左侧侧栏展示基础技能，右侧主栏聚焦经历与项目，视觉层次鲜明。',
    accent: 'bg-warning-50'
  }
];

export function findTemplate(id?: string | null): TemplateMeta {
  return TEMPLATES.find((template) => template.id === id) ?? TEMPLATES[0];
}
