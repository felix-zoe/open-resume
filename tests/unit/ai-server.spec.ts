import { describe, expect, it } from 'vitest';
import {
  buildRewriteMessages,
  normalizeRewriteOutput,
  parseChatContent,
  validateBaseUrl,
  validateModelListRequest,
  validateRewriteRequest,
  mapUpstreamError,
  joinEndpoint
} from '../../functions/lib/ai';

/**
 * 服务端 AI 网关的单元测试。
 *
 * 重点是自定义 base URL 的校验：用户能填地址，就等于能让我们替他发请求，
 * 少一条规则就是一个 SSRF。这几条断言是那个防线的回归测试。
 */

const validBody = {
  providerId: 'deepseek',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: 'sk-abcdefghijklmn',
  model: 'deepseek-chat',
  text: '负责公司官网前端开发。',
  style: 'concise',
  target: 'work'
};

describe('validateBaseUrl', () => {
  it('预设厂商一律回落到内置地址，本地传什么都被忽略', () => {
    const result = validateBaseUrl('https://evil.example.com/v1', 'deepseek');
    expect(result.ok).toBe(true);
    expect(result.url).toBe('https://api.deepseek.com/v1');
  });

  it('未知厂商直接拒绝', () => {
    expect(validateBaseUrl('https://x.example.com', 'not-a-provider').ok).toBe(false);
  });

  it('自定义厂商必须是 https', () => {
    expect(validateBaseUrl('http://gw.example.com/v1', 'custom').ok).toBe(false);
    expect(validateBaseUrl('https://gw.example.com/v1', 'custom').ok).toBe(true);
  });

  it('挡住本机与内网地址（SSRF）', () => {
    const blocked = [
      'https://localhost/v1',
      'https://127.0.0.1/v1',
      'https://10.0.0.5/v1',
      'https://192.168.1.10/v1',
      'https://172.16.0.1/v1',
      'https://169.254.169.254/latest/meta-data',
      'https://metadata.google.internal/v1',
      'https://svc.local/v1',
      'https://[::1]/v1'
    ];
    for (const url of blocked) {
      expect(validateBaseUrl(url, 'custom').ok, url).toBe(false);
    }
  });

  it('172.32.x 属于公网，不该被 172.16/12 的规则误伤', () => {
    expect(validateBaseUrl('https://172.32.0.1/v1', 'custom').ok).toBe(true);
  });

  it('拒绝带账号密码或查询串的地址', () => {
    expect(validateBaseUrl('https://user:pass@gw.example.com/v1', 'custom').ok).toBe(false);
    expect(validateBaseUrl('https://gw.example.com/v1?token=x', 'custom').ok).toBe(false);
  });

  it('去掉末尾斜杠，便于拼端点', () => {
    const result = validateBaseUrl('https://gw.example.com/v1/', 'custom');
    expect(result.url).toBe('https://gw.example.com/v1');
    expect(joinEndpoint(result.url, '/chat/completions')).toBe('https://gw.example.com/v1/chat/completions');
  });
});

describe('validateRewriteRequest', () => {
  it('完整参数通过并规范化', () => {
    const result = validateRewriteRequest(validBody);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.apiKey).toBe('sk-abcdefghijklmn');
      expect(result.value.baseUrl).toBe('https://api.deepseek.com/v1');
    }
  });

  it('缺 Key / 缺模型 / 缺原文各自给出可操作的提示', () => {
    const noKey = validateRewriteRequest({ ...validBody, apiKey: '' });
    expect(noKey.ok).toBe(false);
    if (!noKey.ok) expect(noKey.error.message).toContain('API Key');

    const noModel = validateRewriteRequest({ ...validBody, model: '  ' });
    expect(noModel.ok).toBe(false);
    if (!noModel.ok) expect(noModel.error.message).toContain('模型名');

    const noText = validateRewriteRequest({ ...validBody, text: '' });
    expect(noText.ok).toBe(false);
    if (!noText.ok) expect(noText.error.message).toContain('可改写');
  });

  it('拒绝未知风格', () => {
    const result = validateRewriteRequest({ ...validBody, style: 'make-me-a-star' });
    expect(result.ok).toBe(false);
  });

  it('原文超长时拒绝，并说明上限', () => {
    const result = validateRewriteRequest({ ...validBody, text: 'a'.repeat(2001) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('2000');
  });

  it('所有失败都用 4xx/5xx 而不是 401，避免前端误判成登录过期', () => {
    const cases = [
      validateRewriteRequest({ ...validBody, apiKey: '' }),
      validateRewriteRequest({ ...validBody, providerId: 'nope' }),
      validateRewriteRequest({ ...validBody, providerId: 'custom', baseUrl: 'http://x.example.com' })
    ];
    for (const result of cases) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.status).not.toBe(401);
    }
  });
});

describe('validateModelListRequest', () => {
  it('只校验厂商与 Key，不需要模型名', () => {
    const result = validateModelListRequest({ providerId: 'moonshot', apiKey: 'sk-x' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.baseUrl).toBe('https://api.moonshot.cn/v1');
  });
});

describe('buildRewriteMessages', () => {
  const messages = buildRewriteMessages({
    text: '负责官网开发',
    style: 'quantify',
    target: 'work',
    instruction: '面向 B 端客户'
  });

  it('系统提示词写死「不得编造事实」与占位符出口', () => {
    const system = messages[0].content;
    expect(system).toContain('不得编造事实');
    expect(system).toContain('[请补充具体数据]');
    expect(system).toContain('只输出改写后的正文');
  });

  it('风格指令拼在系统提示词后面', () => {
    expect(messages[0].content).toContain('突出成果');
  });

  it('用户消息里带上目标类型、额外要求与原文边界', () => {
    const user = messages[1].content;
    expect(user).toContain('工作经历');
    expect(user).toContain('面向 B 端客户');
    expect(user).toContain('负责官网开发');
  });

  it('岗位背景可选，不传时不出现空段落', () => {
    const without = buildRewriteMessages({ text: 'x', style: 'fix', target: 'custom' });
    expect(without[1].content).not.toContain('目标岗位背景');
  });
});

describe('parseChatContent', () => {
  it('读取 OpenAI 形态的 choices[0].message.content', () => {
    expect(parseChatContent({ choices: [{ message: { content: '改写结果' } }] })).toBe('改写结果');
  });

  it('兼容内容数组形态（部分网关会这么返回）', () => {
    expect(parseChatContent({ choices: [{ message: { content: [{ type: 'text', text: '你好' }] } }] })).toBe('你好');
  });

  it('拿不到正文时返回 null，而不是猜一个字段', () => {
    expect(parseChatContent({ error: { message: 'bad' } })).toBeNull();
    expect(parseChatContent(null)).toBeNull();
  });
});

describe('normalizeRewriteOutput', () => {
  it('剥掉整体包裹的代码块', () => {
    expect(normalizeRewriteOutput('```\n主导官网重构\n```')).toBe('主导官网重构');
  });

  it('剥掉开头的中文引导语', () => {
    expect(normalizeRewriteOutput('改写后的内容：\n主导官网重构')).toBe('主导官网重构');
  });

  it('压缩多余空行', () => {
    expect(normalizeRewriteOutput('一段\n\n\n\n二段')).toBe('一段\n\n二段');
  });

  it('保留正常的多行结构', () => {
    expect(normalizeRewriteOutput('第一条\n第二条')).toBe('第一条\n第二条');
  });
});

describe('mapUpstreamError', () => {
  it('401/403 指向 Key 问题，并带上服务商原话', () => {
    const error = mapUpstreamError(403, { error: { message: 'invalid api key' } });
    expect(error.message).toContain('API Key');
    expect(error.message).toContain('invalid api key');
  });

  it('404 指向地址或模型名，改的东西完全不同', () => {
    const error = mapUpstreamError(404, {});
    expect(error.message).toContain('模型名');
  });

  it('429 提示限流或余额', () => {
    expect(mapUpstreamError(429, {}).message).toContain('余额');
  });

  it('其余状态统一回退到服务商接口错误', () => {
    const error = mapUpstreamError(500, { message: 'internal error' });
    expect(error.status).toBe(502);
    expect(error.message).toContain('500');
  });
});