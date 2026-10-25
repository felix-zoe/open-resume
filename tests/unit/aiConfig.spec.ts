import { afterEach, describe, expect, it } from 'vitest';
import {
  clearAiConfig,
  defaultAiConfig,
  describeAiConfig,
  isAiReady,
  loadAiConfig,
  maskApiKey,
  resolveApiKey,
  resolveBaseUrl,
  resolveModel,
  saveAiConfig,
  withApiKey,
  withModel,
  withProvider
} from '../../src/utils/aiConfig';

const STORAGE_KEY = 'open_resume_ai_config';

afterEach(() => {
  localStorage.clear();
});

describe('配置读写', () => {
  it('没有存储时返回默认配置', () => {
    expect(loadAiConfig().providerId).toBe('deepseek');
  });

  it('存了再读能拿到同一份配置', () => {
    const config = withApiKey(withModel(defaultAiConfig(), 'deepseek-chat'), 'sk-abcdefghijklmn');
    saveAiConfig(config);

    const loaded = loadAiConfig();
    expect(resolveModel(loaded)).toBe('deepseek-chat');
    expect(resolveApiKey(loaded)).toBe('sk-abcdefghijklmn');
  });

  it('存储内容损坏时退回默认值，而不是抛错让编辑器打不开', () => {
    localStorage.setItem(STORAGE_KEY, '{ not json');
    expect(loadAiConfig().providerId).toBe('deepseek');

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ providerId: 'never-heard-of' }));
    expect(loadAiConfig().providerId).toBe('deepseek');
  });

  it('关掉「记住 Key」后落盘时把 Key 摘掉，其余设置保留', () => {
    const config = { ...withApiKey(defaultAiConfig(), 'sk-secret'), rememberKey: false };
    saveAiConfig(config);

    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) as string);
    expect(raw.keys).toEqual({});
    expect(raw.providerId).toBe('deepseek');
  });

  it('清空后回到默认配置', () => {
    saveAiConfig(withApiKey(defaultAiConfig(), 'sk-x'));
    clearAiConfig();
    expect(resolveApiKey(loadAiConfig())).toBe('');
  });
});

describe('按厂商解析', () => {
  it('预设厂商的地址以内置表为准，忽略本地存的 baseUrl', () => {
    const config = { ...defaultAiConfig(), baseUrl: 'https://evil.example.com/v1' };
    expect(resolveBaseUrl(config)).toBe('https://api.deepseek.com/v1');
  });

  it('自定义厂商才使用本地填的地址', () => {
    const config = { ...defaultAiConfig(), providerId: 'custom', baseUrl: 'https://gw.example.com/v1' };
    expect(resolveBaseUrl(config)).toBe('https://gw.example.com/v1');
  });

  it('切换厂商时带上该厂商的默认模型，切回来还记得改过的模型', () => {
    let config = withProvider(defaultAiConfig(), 'zhipu');
    expect(resolveModel(config)).toBe('glm-4-flash');

    config = withModel(config, 'glm-4-plus');
    config = withProvider(config, 'deepseek');
    expect(resolveModel(config)).toBe('deepseek-chat');

    config = withProvider(config, 'zhipu');
    expect(resolveModel(config)).toBe('glm-4-plus');
  });

  it('自定义厂商自己填的地址会被记住，切到预设厂商也不会被它污染', () => {
    let config = withProvider({ ...defaultAiConfig(), baseUrl: 'https://gw.example.com/v1' }, 'custom');
    // 切到自定义时保留上次填过的地址，不用重打一遍
    expect(resolveBaseUrl(config)).toBe('https://gw.example.com/v1');

    config = withProvider(config, 'deepseek');
    // 本地还留着那条地址，但预设厂商一律以内置表为准
    expect(resolveBaseUrl(config)).toBe('https://api.deepseek.com/v1');
  });
});

describe('就绪判定与展示', () => {
  it('四项齐全才算就绪', () => {
    let config = defaultAiConfig();
    expect(isAiReady(config)).toBe(false);

    config = withModel(config, 'deepseek-chat');
    expect(isAiReady(config)).toBe(false);

    config = withApiKey(config, 'sk-abcdefghijklmn');
    expect(isAiReady(config)).toBe(true);
  });

  it('火山方舟默认没有模型名，需要用户自己填接入点', () => {
    const config = withProvider(defaultAiConfig(), 'ark');
    expect(isAiReady(config)).toBe(false);
  });

  it('状态文案带上厂商与模型', () => {
    const config = withApiKey(withModel(withProvider(defaultAiConfig(), 'dashscope'), 'qwen-plus'), 'sk-x');
    expect(describeAiConfig(config)).toContain('qwen-plus');
  });
});

describe('maskApiKey', () => {
  it('只露出头尾，够认人又读不完整', () => {
    expect(maskApiKey('sk-1234567890abcdef')).toBe('sk-1****cdef');
  });

  it('短 Key 直接截断，避免露出全部', () => {
    expect(maskApiKey('abc')).toBe('abc****');
    expect(maskApiKey('')).toBe('');
  });
});