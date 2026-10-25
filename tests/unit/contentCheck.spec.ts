import { describe, expect, it } from 'vitest';
import { checkBullets, summarizeIssues, MAX_BULLET_LENGTH } from '../../src/utils/contentCheck';
import type { ResumeContent } from '../../src/types/resume';

function makeContent(workDescription: string, projectDescription = ''): ResumeContent {
  return {
    profile: { name: '张三', title: '', email: '', phone: '', showAvatar: false },
    modulesOrder: ['work', 'projects', 'skills', 'education', 'custom'],
    modules: {
      work: {
        visible: true,
        title: '工作经历',
        items: [
          {
            id: 'w1',
            company: '某公司',
            position: '前端',
            startDate: '2021.01',
            endDate: '至今',
            description: workDescription
          }
        ]
      },
      projects: {
        visible: true,
        title: '项目经历',
        items: projectDescription
          ? [
              {
                id: 'p1',
                name: '项目',
                role: '开发',
                startDate: '2023.01',
                endDate: '2023.12',
                description: projectDescription
              }
            ]
          : []
      },
      skills: { visible: true, title: '技能', items: [] },
      education: { visible: true, title: '教育', items: [] },
      custom: { visible: false, title: '自定义', items: [] }
    }
  };
}

const kinds = (description: string) =>
  checkBullets(makeContent(description)).map((issue) => issue.kind);

describe('checkBullets', () => {
  it('优质描述（强动词 + 数字）不报任何问题', () => {
    expect(kinds('主导性能优化，首屏耗时降低 40%')).toEqual([]);
  });

  it('弱动词开头被识别', () => {
    expect(kinds('负责日常维护，覆盖 12 个服务')).toContain('weak-verb');
  });

  it('弱动词只在前 6 个字里找，正文中段不误判', () => {
    const issues = kinds('主导订单系统重构，配合团队完成 3 次大促');
    expect(issues).not.toContain('weak-verb');
  });

  it('缺少量化数据被识别', () => {
    expect(kinds('主导订单系统重构')).toContain('no-metric');
  });

  it('识别百分比、倍数、人次等多种量化写法', () => {
    for (const text of ['提升 30%', '提升 3 倍', '服务 200 万人次', '处理 5k 请求']) {
      expect(kinds(`主导优化，${text}`)).not.toContain('no-metric');
    }
  });

  it('过长描述被识别', () => {
    const long = `主导${'很长的描述'.repeat(MAX_BULLET_LENGTH / 4)}，提升 40%`;
    expect(kinds(long)).toContain('too-long');
  });

  it('占位符未替换被识别', () => {
    expect(kinds('主导 [核心模块] 改造，提升 40%')).toContain('placeholder');
  });

  it('空洞表述被识别', () => {
    expect(kinds('主导相关工作，处理 30 项任务')).toContain('vague');
  });

  it('空行不产生问题', () => {
    expect(kinds('主导优化，提升 40%\n\n')).toEqual([]);
  });

  it('项目经历同样被扫描', () => {
    const issues = checkBullets(makeContent('主导优化，提升 40%', '负责项目维护'));
    expect(issues.some((issue) => issue.module === 'projects')).toBe(true);
  });

  it('定位信息包含 itemId 与行号', () => {
    const issues = checkBullets(makeContent('主导优化，提升 40%\n负责维护'));
    const weak = issues.find((issue) => issue.kind === 'weak-verb');
    expect(weak?.itemId).toBe('w1');
    expect(weak?.lineIndex).toBe(1);
    expect(weak?.module).toBe('work');
  });

  it('可通过 enabled 关闭某类检查', () => {
    const issues = checkBullets(makeContent('负责维护'), { enabled: { 'no-metric': false } });
    expect(issues.some((issue) => issue.kind === 'no-metric')).toBe(false);
    expect(issues.some((issue) => issue.kind === 'weak-verb')).toBe(true);
  });

  it('一行可同时命中多个问题', () => {
    const result = kinds('负责 [模块] 相关工作');
    expect(result).toContain('weak-verb');
    expect(result).toContain('placeholder');
    expect(result).toContain('no-metric');
    expect(result).toContain('vague');
  });
});

describe('summarizeIssues', () => {
  it('按类型计数，未出现的类型为 0', () => {
    const summary = summarizeIssues(checkBullets(makeContent('负责维护')));
    expect(summary['weak-verb']).toBe(1);
    expect(summary.placeholder).toBe(0);
  });

  it('空列表全部为 0', () => {
    const summary = summarizeIssues([]);
    expect(Object.values(summary).every((value) => value === 0)).toBe(true);
  });
});
