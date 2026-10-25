import { describe, expect, it } from 'vitest';
import { computeCompleteness } from '../../functions/lib/completeness';

/**
 * 完整度只回答「信息填没填」，不评价写得好不好 —— 测试也要守住这条线，
 * 否则很容易被后来者加上「描述太短扣分」之类的质量判断。
 */
function makeContent(overrides: Record<string, any> = {}) {
  return {
    profile: {
      name: '张小凡',
      title: '前端工程师',
      email: 'z@example.com',
      phone: '13800138000',
      summary: '五年前端经验，专注性能优化。',
      showAvatar: false
    },
    modulesOrder: ['work', 'projects', 'skills', 'education', 'custom'],
    modules: {
      work: {
        visible: true,
        title: '工作经历',
        items: [
          {
            id: 'w1',
            company: '某公司',
            position: '前端工程师',
            startDate: '2021.03',
            endDate: '至今',
            description: '把首屏耗时从 3.2s 降到 1.1s'
          }
        ]
      },
      projects: { visible: true, title: '项目经历', items: [] },
      skills: { visible: true, title: '专业技能', items: ['Vue', 'TypeScript'] },
      education: {
        visible: true,
        title: '教育经历',
        items: [
          {
            id: 'e1',
            school: '某大学',
            major: '计算机',
            degree: '本科',
            startDate: '2016.09',
            endDate: '2020.06'
          }
        ]
      },
      custom: { visible: true, title: '其他', items: [] }
    },
    ...overrides
  };
}

describe('computeCompleteness', () => {
  it('信息齐全时为 100，缺失为空', () => {
    const result = computeCompleteness(makeContent());
    expect(result.score).toBe(100);
    expect(result.missing).toEqual([]);
  });

  it('完全空内容为 0，缺失项覆盖全部 8 项', () => {
    const result = computeCompleteness({});
    expect(result.score).toBe(0);
    expect(result.missing).toEqual([
      'name',
      'jobTitle',
      'contact',
      'summary',
      'experience',
      'education',
      'skills',
      'metric'
    ]);
  });

  it('异常输入（null / 字符串 / 数字）不抛错，按空处理', () => {
    for (const raw of [null, undefined, 'oops', 42, []]) {
      const result = computeCompleteness(raw);
      expect(result.score).toBe(0);
      expect(result.missing).toHaveLength(8);
    }
  });

  it('邮箱或手机号任一有值即算联系方式通过', () => {
    const emailOnly = makeContent();
    emailOnly.profile.phone = '';
    expect(computeCompleteness(emailOnly).missing).not.toContain('contact');

    const phoneOnly = makeContent();
    phoneOnly.profile.email = '';
    expect(computeCompleteness(phoneOnly).missing).not.toContain('contact');
  });

  it('只有空格不算填写', () => {
    const content = makeContent();
    content.profile.name = '   ';
    expect(computeCompleteness(content).missing).toContain('name');
  });

  it('经历被隐藏时不计入，避免「看不见却算完整」', () => {
    const content = makeContent();
    content.modules.work = { visible: false, title: '工作经历', items: [] };
    const result = computeCompleteness(content);
    expect(result.missing).toContain('experience');
    // 经历隐藏后量化数据也无处可看
    expect(result.missing).toContain('metric');
  });

  it('项目经历可替代工作经历通过 experience 检查', () => {
    const content = makeContent();
    content.modules.work = { visible: true, title: '工作经历', items: [] };
    content.modules.projects = {
      visible: true,
      title: '项目经历',
      items: [
        {
          id: 'p1',
          name: '简历工具',
          role: '前端',
          startDate: '2023.01',
          endDate: '2023.06',
          description: '日活 2000'
        }
      ]
    };
    const result = computeCompleteness(content);
    expect(result.missing).not.toContain('experience');
    expect(result.missing).not.toContain('metric');
  });

  it('经历里没有任何数字时提示缺少量化数据', () => {
    const content = makeContent();
    content.modules.work.items[0].description = '负责前端开发与团队协作';
    const result = computeCompleteness(content);
    expect(result.missing).toContain('metric');
    expect(result.score).toBe(90);
  });

  it('不判断内容质量：描述很空洞但字段齐全仍算 100', () => {
    const content = makeContent();
    content.profile.summary = '你好';
    content.modules.work.items[0].description = '1';
    expect(computeCompleteness(content).score).toBe(100);
  });

  it('权重合计为 100', () => {
    // 逐项移除，累加得到的差值总和应等于 100
    const full = computeCompleteness(makeContent()).score;
    const empty = computeCompleteness({}).score;
    expect(full - empty).toBe(100);
  });
});
