import { describe, expect, it } from 'vitest';
import {
  issuesToMessage,
  saveResumeSchema,
  shareLinkSchema,
  themeConfigSchema,
  validate
} from '../../functions/lib/schemas';

const minimalContent = {
  profile: { name: '张三', title: '前端工程师', email: 'a@b.com', phone: '13800138000', showAvatar: false },
  modulesOrder: ['work', 'projects', 'skills', 'education', 'custom'],
  modules: {
    work: { visible: true, title: '工作经历', items: [] },
    projects: { visible: true, title: '项目经历', items: [] },
    skills: { visible: true, title: '专业技能', items: ['TypeScript'] },
    education: { visible: true, title: '教育背景', items: [] },
    custom: { visible: false, title: '自定义模块', items: [] }
  }
};

describe('saveResumeSchema', () => {
  it('合法简历通过', () => {
    const result = validate(saveResumeSchema, {
      title: '我的简历',
      templateId: 'modern',
      content: minimalContent,
      themeConfig: { fontSize: 13, lineHeight: 1.5 }
    });
    expect(result.ok).toBe(true);
  });

  it('未知模板 id 被拒 —— 否则前端切不到该模板却已写库', () => {
    const result = validate(saveResumeSchema, { templateId: 'fancy' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0].path).toBe('templateId');
  });

  it('modulesOrder 里的脏键被拒', () => {
    const result = validate(saveResumeSchema, {
      content: { modulesOrder: ['work', 'salary'] }
    });
    expect(result.ok).toBe(false);
  });

  it('未知字段不报错（用户数据不该因多一个字段整份保存失败）', () => {
    const result = validate(saveResumeSchema, { title: 'x', futureField: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.data as any).title).toBe('x');
  });

  it('标题超长被拒', () => {
    expect(validate(saveResumeSchema, { title: 'x'.repeat(101) }).ok).toBe(false);
  });

  it('isPublic 同时接受数字与布尔（历史客户端两种都发过）', () => {
    expect(validate(saveResumeSchema, { isPublic: 1 }).ok).toBe(true);
    expect(validate(saveResumeSchema, { isPublic: true }).ok).toBe(true);
  });

  it('数组元素数量有上限，防止超长列表撑爆单行存储', () => {
    const result = validate(saveResumeSchema, {
      content: {
        modules: {
          work: { visible: true, title: '工作', items: Array.from({ length: 61 }, () => ({ id: 'w1' })) }
        }
      }
    });
    expect(result.ok).toBe(false);
  });

  it('错误只返回前 3 条，避免一次甩出几十条无从下手', () => {
    const result = validate(saveResumeSchema, {
      content: { modulesOrder: ['a', 'b', 'c', 'd'] }
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeLessThanOrEqual(3);
  });
});

describe('themeConfigSchema', () => {
  it('字号越界被拒', () => {
    expect(validate(themeConfigSchema, { fontSize: 40 }).ok).toBe(false);
    expect(validate(themeConfigSchema, { fontSize: 14 }).ok).toBe(true);
  });

  it('页边距不能为负', () => {
    expect(validate(themeConfigSchema, { pagePadding: -1 }).ok).toBe(false);
  });
});

describe('shareLinkSchema', () => {
  it('只接受 7d / 30d / permanent', () => {
    expect(validate(shareLinkSchema, { ttl: '7d' }).ok).toBe(true);
    expect(validate(shareLinkSchema, { ttl: '1y' }).ok).toBe(false);
  });

  it('空对象合法（全部用默认值）', () => {
    expect(validate(shareLinkSchema, {}).ok).toBe(true);
  });
});

describe('issuesToMessage', () => {
  it('拼出带字段路径的可诊断文案', () => {
    const message = issuesToMessage([{ path: 'templateId', message: 'Invalid enum value' }]);
    expect(message).toContain('templateId');
    expect(message).toContain('Invalid enum value');
    expect(message.startsWith('请求参数不合法')).toBe(true);
  });
});
