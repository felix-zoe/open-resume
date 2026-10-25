import { describe, expect, it } from 'vitest';
import { buildMarkdown } from '../../src/utils/exportMarkdown';
import type { ResumeContent } from '../../src/types/resume';

function makeContent(): ResumeContent {
  return {
    profile: {
      name: '张三',
      title: '前端工程师',
      email: 'zhang@example.com',
      phone: '13800138000',
      workYears: '5年',
      location: '北京',
      github: 'https://github.com/zhang',
      showAvatar: false,
      summary: '5 年前端经验'
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
            startDate: '2021.01',
            endDate: '至今',
            description: '主导性能优化，首屏降低 40%\n- 负责基建'
          }
        ]
      },
      projects: {
        visible: true,
        title: '项目经历',
        items: [
          {
            id: 'p1',
            name: '简历平台',
            role: '核心开发',
            startDate: '2023.01',
            endDate: '2023.12',
            link: 'https://example.com',
            description: '从零搭建'
          }
        ]
      },
      skills: { visible: true, title: '专业技能', items: ['Vue3', 'TypeScript'] },
      education: {
        visible: true,
        title: '教育背景',
        items: [
          {
            id: 'e1',
            school: '某大学',
            major: '计算机',
            degree: '本科',
            startDate: '2015.09',
            endDate: '2019.06'
          }
        ]
      },
      custom: { visible: false, title: '自定义模块', items: ['不应出现'] }
    }
  };
}

describe('buildMarkdown', () => {
  const md = buildMarkdown({ title: '我的简历', content: makeContent() });

  it('以姓名为一级标题，而不是「我的简历」', () => {
    expect(md.startsWith('# 张三')).toBe(true);
  });

  it('抬头包含求职意向与联系方式', () => {
    expect(md).toContain('**前端工程师 · 5年 · 北京**');
    expect(md).toContain('13800138000');
    expect(md).toContain('zhang@example.com');
  });

  it('按 modulesOrder 输出章节，隐藏模块被跳过', () => {
    expect(md).toContain('## 工作经历');
    expect(md).toContain('## 项目经历');
    expect(md).toContain('## 专业技能');
    expect(md).toContain('## 教育背景');
    expect(md).not.toContain('不应出现');
  });

  it('描述按行拆成 bullet，并去掉用户已写的 bullet 前缀', () => {
    expect(md).toContain('- 主导性能优化，首屏降低 40%');
    expect(md).toContain('- 负责基建');
    expect(md).not.toContain('- - 负责基建');
  });

  it('经历条目标题带日期区间', () => {
    expect(md).toContain('### 某公司 · 前端工程师（2021.01 – 至今）');
  });

  it('项目链接单独成行', () => {
    expect(md).toContain('链接：https://example.com');
  });

  it('技能用顿号连接成一行', () => {
    expect(md).toContain('Vue3、TypeScript');
  });

  it('转义 Markdown 特殊字符，避免文本被渲染成格式', () => {
    const content = makeContent();
    content.modules.skills.items = ['C*C++', 'a_b'];
    const out = buildMarkdown({ title: 'x', content });
    expect(out).toContain('C\\*C++');
    expect(out).toContain('a\\_b');
  });

  it('不产生连续三个以上空行', () => {
    expect(md).not.toMatch(/\n{3,}/);
  });

  it('末尾恰好一个换行', () => {
    expect(md.endsWith('\n')).toBe(true);
    expect(md.endsWith('\n\n')).toBe(false);
  });
});
