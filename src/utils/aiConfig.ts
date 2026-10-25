/**
 * AI 改写的本地配置（T5.7）。
 *
 * 用户自带 Key，所以**配置只存在浏览器里**：服务端在转发完这一次请求后就
 * 不再持有它，也没有任何一张表用来存它。这与登录 token 的存放位置一致
 * （localStorage），但 Key 更敏感 —— 因此多给一个「不记住」开关，
 * 用一次粘一次，公共电脑上也能用。
 *
 * 按厂商分别记住模型与 Key：换一圈厂商回来接着用，不必重填。
 */

import { CUSTOM_PROVIDER_ID, findAiProvider } from '../../shared/ai';

const STORAGE_KEY = 'open_resume_ai_config';

export interface AiConfig {
  providerId: string;
  /** 自定义厂商的接口地址；预设厂商忽略此字段（地址以 `shared/ai.ts` 为准） */
  baseUrl: string;
  /** 各厂商最近使用的模型 */
  models: Record<string, string>;
  /** 各厂商的 API Key；`rememberKey` 为 false 时这里始终为空 */
  keys: Record<string, string>;
  /** 是否把 Key 记住；关掉后关闭页面即清空 */
  rememberKey: boolean;
}

export function defaultAiConfig(): AiConfig {
  return {
    providerId: 'deepseek',
    baseUrl: '',
    models: {},
    keys: {},
    rememberKey: true
  };
}

/** 读取配置。任何解析异常都退回默认值 —— 一份坏掉的配置不该让编辑器打不开 */
export function loadAiConfig(): AiConfig {
  const fallback = defaultAiConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AiConfig>;
    if (!parsed || typeof parsed !== 'object') return fallback;
    if (!findAiProvider(String(parsed.providerId))) return fallback;

    return {
      providerId: String(parsed.providerId),
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
      models: typeof parsed.models === 'object' && parsed.models ? { ...parsed.models } : {},
      keys: typeof parsed.keys === 'object' && parsed.keys ? { ...parsed.keys } : {},
      rememberKey: parsed.rememberKey !== false
    };
  } catch {
    return fallback;
  }
}

export function saveAiConfig(config: AiConfig): boolean {
  try {
    // 用户选择「不记住」时仍然写盘，但把 Key 摘掉：其余设置（厂商、模型）
    // 留着才不至于每次打开都要重选一遍
    const payload: AiConfig = config.rememberKey ? config : { ...config, keys: {} };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    // 隐身模式 / 配额满：配置存不下不影响本次使用，内存里那份仍然是新的
    return false;
  }
}

export function clearAiConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 忽略 */
  }
}

/** 实际请求要用的接口地址 */
export function resolveBaseUrl(config: AiConfig): string {
  if (config.providerId === CUSTOM_PROVIDER_ID) return config.baseUrl.trim();
  return findAiProvider(config.providerId)?.baseUrl ?? '';
}

export function resolveModel(config: AiConfig): string {
  return (config.models[config.providerId] ?? '').trim();
}

export function resolveApiKey(config: AiConfig): string {
  return (config.keys[config.providerId] ?? '').trim();
}

/** 四项齐全才允许点「开始改写」，缺哪项由表单就地提示 */
export function isAiReady(config: AiConfig): boolean {
  return (
    !!findAiProvider(config.providerId) &&
    !!resolveBaseUrl(config) &&
    !!resolveModel(config) &&
    !!resolveApiKey(config)
  );
}

/**
 * 打码展示。
 *
 * 只留头尾各 4 位：足以让用户确认「这是我那把 Key」，
 * 又不至于在旁人扫一眼屏幕时被完整读走。
 */
export function maskApiKey(key: string): string {
  const value = key.trim();
  if (!value) return '';
  if (value.length <= 12) return `${value.slice(0, 3)}****`;
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

/** 顶部状态条上的「当前用的是什么」 */
export function describeAiConfig(config: AiConfig): string {
  const provider = findAiProvider(config.providerId);
  const model = resolveModel(config);
  if (!provider) return '未配置';
  return model ? `${provider.name} · ${model}` : provider.name;
}

/** 切换厂商时把该厂商的默认模型填上，除非之前已经为它选过 */
export function withProvider(config: AiConfig, providerId: string): AiConfig {
  const provider = findAiProvider(providerId);
  if (!provider) return config;

  const models = { ...config.models };
  if (!models[providerId] && provider.defaultModel) models[providerId] = provider.defaultModel;

  return {
    ...config,
    providerId,
    models,
    // 自定义厂商没有预设地址，切过去时清空，避免把别家的域名当自己的用
    baseUrl: providerId === CUSTOM_PROVIDER_ID ? config.baseUrl : ''
  };
}

export function withModel(config: AiConfig, model: string): AiConfig {
  return { ...config, models: { ...config.models, [config.providerId]: model } };
}

export function withApiKey(config: AiConfig, apiKey: string): AiConfig {
  return { ...config, keys: { ...config.keys, [config.providerId]: apiKey } };
}

export function withBaseUrl(config: AiConfig, baseUrl: string): AiConfig {
  return { ...config, baseUrl };
}