import { describe, expect, it } from 'vitest';
import {
  checkResumeContent,
  findPlaceholders,
  validateEmail,
  validatePhone,
  validateUrl
} from '../../src/utils/validation';

describe('validatePhone', () => {
  it('标准 11 位手机号通过', () => {
    expect(validatePhone('13800138000').valid).toBe(true);
  });

  it('带空格或短横线也能通过', () => {
    expect(validatePhone('138 0013 8000').valid).toBe(true);
    expect(validatePhone('138-0013-8000').valid).toBe(true);
  });

  it('位数不足或号段非法被拒绝', () => {
    expect(validatePhone('1380013800').valid).toBe(false);
    expect(validatePhone('12800138000').valid).toBe(false);
  });

  it('空值提示「请填写」而不是格式错误', () => {
    const result = validatePhone('');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('请填写');
  });

  it('座机号不通过（简历场景默认手机）', () => {
    expect(validatePhone('010-12345678').valid).toBe(false);
  });
});

describe('validateEmail', () => {
  it('常规邮箱通过', () => {
    expect(validateEmail('xiaofan.zhang@example.com').valid).toBe(true);
    expect(validateEmail('a@b.co').valid).toBe(true);
  });

  it('缺 @ / 缺域名 / 含空格被拒绝', () => {
    expect(validateEmail('not-an-email').valid).toBe(false);
    expect(validateEmail('a@b').valid).toBe(false);
    expect(validateEmail('a b@example.com').valid).toBe(false);
  });

  it('空值提示「请填写」', () => {
    expect(validateEmail('').message).toContain('请填写');
  });
});

describe('validateUrl', () => {
  it('完整 https 链接通过', () => {
    expect(validateUrl('https://github.com/example').valid).toBe(true);
  });

  it('裸域名自动补协议后通过', () => {
    expect(validateUrl('blog.example.com').valid).toBe(true);
  });

  it('空值是合法的（选填字段）', () => {
    expect(validateUrl('').valid).toBe(true);
  });

  it('javascript: 协议在录入阶段就拦下', () => {
    const result = validateUrl('javascript:alert(1)');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('协议');
  });

  it('data: 与 vbscript: 同样拒绝', () => {
    expect(validateUrl('data:text/html,<script>').valid).toBe(false);
    expect(validateUrl('vbscript:msgbox(1)').valid).toBe(false);
  });

  it('无点号的 hostname 被拒绝', () => {
    expect(validateUrl('localhost').valid).toBe(false);
  });
});

describe('findPlaceholders', () => {
  it('识别方括号占位符', () => {
    const hits = findPlaceholders('负责 [核心模块] 的重构');
    expect(hits.some((hit) => hit.text === '[核心模块]')).toBe(true);
  });

  it('识别 XX% 与 xxx', () => {
    expect(findPlaceholders('提升 XX% 性能').length).toBeGreaterThan(0);
    expect(findPlaceholders('提升 xxx 性能').length).toBeGreaterThan(0);
  });

  it('识别中文方括号', () => {
    expect(findPlaceholders('【公司名称】').some((hit) => hit.text === '【公司名称】')).toBe(true);
  });

  it('正常文本不误报', () => {
    expect(findPlaceholders('负责核心交易链路的性能优化，QPS 提升 40%')).toEqual([]);
  });

  it('同一占位符重复出现只报一次', () => {
    const hits = findPlaceholders('[模块] 与 [模块]');
    expect(hits.filter((hit) => hit.text === '[模块]')).toHaveLength(1);
  });

  it('空文本返回空数组', () => {
    expect(findPlaceholders('')).toEqual([]);
  });

  it('多次调用结果一致（正则 lastIndex 不串状态）', () => {
    const text = '[甲] 和 [乙]';
    expect(findPlaceholders(text)).toEqual(findPlaceholders(text));
  });
});

describe('checkResumeContent', () => {
  const complete = {
    profile: {
      name: '张小凡',
      phone: '13800138000',
      email: 'xiaofan@example.com',
      summary: '5 年前端经验'
    },
    modules: {
      work: { visible: true, items: [{ company: '某公司', description: '负责核心业务' }] },
      projects: { visible: false, items: [{ description: '[待补充]' }] }
    }
  };

  it('内容完整时没有 error', () => {
    const issues = checkResumeContent(complete);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });

  it('缺姓名/电话/邮箱给出 error', () => {
    const issues = checkResumeContent({ profile: {}, modules: {} });
    const messages = issues.filter((i) => i.severity === 'error').map((i) => i.message);
    expect(messages).toContain('缺少姓名');
    expect(messages).toContain('缺少联系电话');
    expect(messages).toContain('缺少电子邮箱');
  });

  it('格式错误只给 warning，不阻塞导出', () => {
    const issues = checkResumeContent({
      profile: { name: '张三', phone: '123', email: 'bad', summary: 'x' },
      modules: {}
    });
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
  });

  it('隐藏模块里的占位符不提示', () => {
    const issues = checkResumeContent(complete);
    expect(issues.some((issue) => issue.message.includes('占位符'))).toBe(false);
  });

  it('可见模块里的占位符提示所在模块', () => {
    const issues = checkResumeContent({
      ...complete,
      modules: {
        work: { visible: true, items: [{ description: '负责 [核心模块] 的重构' }] }
      }
    });
    const hit = issues.find((issue) => issue.message.includes('占位符'));
    expect(hit?.module).toBe('work');
  });

  it('null 内容不抛错', () => {
    expect(checkResumeContent(null)).toEqual([]);
  });

  it('空对象返回「缺必填项」，而不是静默通过', () => {
    const issues = checkResumeContent({});
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue) => issue.module === 'profile')).toBe(true);
  });
});
