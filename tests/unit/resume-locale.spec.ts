import { describe, expect, it } from 'vitest';
import {
  MODULE_TITLES,
  formatDate,
  formatDateRange,
  getLabels,
  joinList,
  localizeModuleTitles,
  normalizeLocale,
  resolveModuleTitle,
  wrapParen
} from '../../src/i18n/resumeLabels';
import { DEFAULT_EN_RESUME_CONTENT, buildEmptyContent } from '../../src/utils/presets';

/**
 * 简历本地化的核心风险是「覆盖用户写的内容」与「历史数据渲染成空白」，
 * 这两点各有一组用例锁定。
 */
describe('简历语言：locale 归一', () => {
  it('未知/缺失/非字符串一律回退 zh-CN', () => {
    expect(normalizeLocale(undefined)).toBe('zh-CN');
    expect(normalizeLocale(null)).toBe('zh-CN');
    expect(normalizeLocale('fr')).toBe('zh-CN');
    expect(normalizeLocale(42)).toBe('zh-CN');
  });

  it('合法值原样保留', () => {
    expect(normalizeLocale('zh-CN')).toBe('zh-CN');
    expect(normalizeLocale('en')).toBe('en');
  });
});

describe('简历语言：模块标题', () => {
  it('标题仍是默认值时跟随语言切换', () => {
    expect(resolveModuleTitle('work', '工作经历', 'en')).toBe('Work Experience');
    expect(resolveModuleTitle('work', 'Work Experience', 'zh-CN')).toBe('工作经历');
  });

  it('用户自定义标题不会被覆盖', () => {
    expect(resolveModuleTitle('work', '核心项目与产出', 'en')).toBe('核心项目与产出');
    expect(resolveModuleTitle('skills', 'Selected Work', 'zh-CN')).toBe('Selected Work');
  });

  it('空标题回退到目标语言的默认值', () => {
    expect(resolveModuleTitle('education', '', 'en')).toBe('Education');
    expect(resolveModuleTitle('education', '   ', 'zh-CN')).toBe('教育背景');
  });

  it('五种模块在两种语言下都有默认标题', () => {
    for (const locale of ['zh-CN', 'en'] as const) {
      for (const key of ['work', 'projects', 'skills', 'education', 'custom'] as const) {
        expect(MODULE_TITLES[locale][key].length).toBeGreaterThan(0);
      }
    }
  });

  it('批量切换只动默认值，返回新对象不改原对象', () => {
    const modules = {
      work: { title: '工作经历' },
      skills: { title: '技术栈' }
    };
    const next = localizeModuleTitles(modules, 'en');
    expect(next.work.title).toBe('Work Experience');
    expect(next.skills.title).toBe('技术栈');
    expect(modules.work.title).toBe('工作经历');
    expect(next).not.toBe(modules);
  });
});

describe('简历语言：日期与分隔符', () => {
  it('中文保持 YYYY.MM，英文改写成 MM/YYYY', () => {
    expect(formatDate('2022.07', 'zh-CN')).toBe('2022.07');
    expect(formatDate('2022.07', 'en')).toBe('07/2022');
  });

  it('「至今」按语言替换，两种语言的写法都能识别', () => {
    expect(formatDate('至今', 'en')).toBe('Present');
    expect(formatDate('Present', 'zh-CN')).toBe('至今');
    expect(formatDate('至今', 'zh-CN')).toBe('至今');
  });

  it('无法识别的历史格式原样返回，不静默丢数据', () => {
    expect(formatDate('2022年7月', 'en')).toBe('2022年7月');
    expect(formatDate('', 'en')).toBe('');
    expect(formatDate(undefined, 'en')).toBe('');
  });

  it('日期区间按语言拼接分隔符', () => {
    expect(formatDateRange('2022.07', '至今', 'zh-CN')).toBe('2022.07 – 至今');
    expect(formatDateRange('2022.07', '2024.03', 'en')).toBe('07/2022 – 03/2024');
  });

  it('区间只有一端时不留下悬空分隔符', () => {
    expect(formatDateRange('2022.07', '', 'en')).toBe('07/2022');
    expect(formatDateRange('', '至今', 'en')).toBe('Present');
    expect(formatDateRange('', '', 'en')).toBe('');
  });

  it('括号与列表分隔符按语言区分', () => {
    expect(wrapParen('研发部', 'zh-CN')).toBe('（研发部）');
    expect(wrapParen('R&D', 'en')).toBe(' (R&D)');
    expect(wrapParen('', 'en')).toBe('');
    expect(joinList(['Vue3', 'TypeScript'], 'zh-CN')).toBe('Vue3、TypeScript');
    expect(joinList(['Vue3', 'TypeScript'], 'en')).toBe('Vue3, TypeScript');
  });

  it('固定标签按语言取值', () => {
    expect(getLabels('zh-CN').present).toBe('至今');
    expect(getLabels('en').present).toBe('Present');
    expect(getLabels('en').name).toBe('Your Name');
    expect(getLabels(undefined).portfolio).toBe('作品集');
  });
});

describe('简历语言：空骨架与英文示例', () => {
  it('英文空骨架的模块标题是英文，且姓名为空而不是「姓名」', () => {
    const content = buildEmptyContent('en');
    expect(content.locale).toBe('en');
    expect(content.modules.work.title).toBe('Work Experience');
    expect(content.modules.custom.title).toBe('Additional');
    expect(content.profile.name).toBe('');
    expect(content.modules.work.items).toHaveLength(0);
  });

  it('中文空骨架保持原有默认值', () => {
    const content = buildEmptyContent();
    expect(content.locale).toBe('zh-CN');
    expect(content.modules.work.title).toBe('工作经历');
    expect(content.profile.name).toBe('姓名');
  });

  it('非法 locale 的空骨架回退中文', () => {
    expect(buildEmptyContent('xx').locale).toBe('zh-CN');
  });

  it('英文示例数据自洽：locale、标题、日期格式都是英文写法', () => {
    expect(DEFAULT_EN_RESUME_CONTENT.locale).toBe('en');
    expect(DEFAULT_EN_RESUME_CONTENT.modules.work.title).toBe('Work Experience');
    for (const item of DEFAULT_EN_RESUME_CONTENT.modules.work.items) {
      expect(item.startDate).toMatch(/^\d{2}\/\d{4}$/);
      expect(item.endDate).toMatch(/^(\d{2}\/\d{4}|Present)$/);
    }
    // 英文简历不放照片、不写薪资（外企常见的歧视审查风险）
    expect(DEFAULT_EN_RESUME_CONTENT.profile.showAvatar).toBe(false);
    expect(DEFAULT_EN_RESUME_CONTENT.profile.salaryExpectation).toBeUndefined();
  });
});
