import { describe, expect, it } from 'vitest';
import { parseMarkdown, parsePlainText } from '../../src/utils/importText';
import type { ResumeContent } from '../../src/types/resume';

function defaults(): ResumeContent {
  return {
    profile: {
      name: '',
      title: '',
      email: '',
      phone: '',
      showAvatar: false,
      avatar: 'should-be-cleared'
    },
    modulesOrder: ['work', 'projects', 'skills', 'education', 'custom'],
    modules: {
      work: { visible: true, title: '工作经历', items: [] },
      projects: { visible: true, title: '项目经历', items: [] },
      skills: { visible: true, title: '专业技能', items: [] },
      education: { visible: true, title: '教育背景', items: [] },
      custom: { visible: false, title: '自定义模块', items: [] }
    }
  };
}

const SAMPLE = `张三
前端工程师 · 5 年经验
13800138000 · zhang@example.com · https://github.com/zhang

工作经历
2021.01 - 至今  某公司 · 前端工程师
主导性能优化，首屏耗时降低 40%
负责 TypeScript 基建

教育背景
2015.09 - 2019.06  某大学 · 计算机 · 本科

专业技能
Vue3、TypeScript、Vite`;

describe('parsePlainText', () => {
  const result = parsePlainText(SAMPLE, defaults());

  it('识别章节数量', () => {
    expect(result.sectionCount).toBe(3);
  });

  it('从抬头抽取姓名、意向、手机号、邮箱、网址', () => {
    expect(result.content.profile.name).toBe('张三');
    expect(result.content.profile.title).toBe('前端工程师 · 5 年经验');
    expect(result.content.profile.phone).toBe('13800138000');
    expect(result.content.profile.email).toBe('zhang@example.com');
    expect(result.content.profile.website).toBe('https://github.com/zhang');
  });

  it('带年份的行视为新条目，其余行并入描述', () => {
    const work = result.content.modules.work.items;
    expect(work).toHaveLength(1);
    expect(work[0].description).toContain('主导性能优化');
    expect(work[0].description).toContain('负责 TypeScript 基建');
  });

  it('教育条目同样按年份切分', () => {
    expect(result.content.modules.education.items).toHaveLength(1);
  });

  it('技能按顿号/逗号拆成数组', () => {
    expect(result.content.modules.skills.items).toEqual(['Vue3', 'TypeScript', 'Vite']);
  });

  it('清空 defaults 里的示例数据，不会混入旧内容', () => {
    const withJunk = defaults();
    withJunk.modules.work.items = [
      { id: 'x', company: '旧公司', position: '', startDate: '', endDate: '', description: '' }
    ];
    const out = parsePlainText(SAMPLE, withJunk);
    expect(out.content.modules.work.items).toHaveLength(1);
    expect(out.content.modules.work.items[0].company).not.toBe('旧公司');
  });

  it('没有任何章节标题时 sectionCount 为 0，由调用方提示用户', () => {
    const out = parsePlainText('随便一段话，没有结构', defaults());
    expect(out.sectionCount).toBe(0);
  });

  it('空输入不抛错', () => {
    const out = parsePlainText('', defaults());
    expect(out.sectionCount).toBe(0);
    expect(out.content.modules.work.items).toEqual([]);
  });

  it('自我评价归入自定义模块', () => {
    const out = parsePlainText('张三\n\n自我评价\n学习能力强，注重代码质量', defaults());
    expect(out.content.modules.custom.items.join('')).toContain('学习能力强');
  });
});

describe('parseMarkdown', () => {
  it('Markdown 标题同样能识别章节', () => {
    const md = `# 李四\n\n## 工作经历\n2020.01 - 2022.12 某厂 · 后端\n负责订单系统\n\n## 专业技能\nGo、Redis`;
    const out = parseMarkdown(md, defaults());
    expect(out.sectionCount).toBe(2);
    expect(out.content.profile.name).toBe('李四');
    expect(out.content.modules.skills.items).toEqual(['Go', 'Redis']);
  });

  it('与纯文本解析结果结构一致', () => {
    const md = `# 王五\n\n## 教育背景\n2015.09 - 2019.06 某大学`;
    const out = parseMarkdown(md, defaults());
    expect(out.content.modules.education.items).toHaveLength(1);
  });
});
