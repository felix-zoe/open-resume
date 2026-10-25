/**
 * AI 改写的客户端调用（T5.7）。
 *
 * 一律走本站的 `/api/ai/*` 转发，不在浏览器里直连厂商：
 * · 站点 CSP 是 `connect-src 'self'`，直连发不出去，而这条规则同时是
 *   「页面不会偷偷把你的简历发给第三方」的技术保证，不该为这个功能拆掉；
 * · 大多数厂商不返回 CORS 头，直连本来也走不通。
 *
 * 超时给到 60 秒：服务端自己的上游超时是 45 秒，客户端必须比它更能等 ——
 * 否则先超时的是浏览器，我们辛苦翻译出来的错误文案就永远送不到用户眼前。
 */

import { apiFetch, type ApiResult } from './http';
import { resolveApiKey, resolveBaseUrl, resolveModel, type AiConfig } from './aiConfig';
import type { AiRewriteStyle, AiRewriteTarget } from '../../shared/ai';

/** 客户端超时必须大于服务端的上游超时，见文件头注释 */
const CLIENT_TIMEOUT_MS = 60_000;

export interface AiRewriteData {
  text: string;
  inputChars: number;
  outputChars: number;
}

export interface RewriteRequestInput {
  text: string;
  style: AiRewriteStyle;
  target: AiRewriteTarget;
  instruction?: string;
  context?: string;
}

export async function requestAiRewrite(
  config: AiConfig,
  input: RewriteRequestInput
): Promise<ApiResult<AiRewriteData>> {
  return apiFetch<AiRewriteData>('/api/ai/rewrite', {
    method: 'POST',
    // 不带头部的登录态：这个接口不需要账号，带上只会让「Key 错了」和
    // 「登录过期了」两件不相干的事在错误分支里混在一起
    auth: false,
    timeout: CLIENT_TIMEOUT_MS,
    body: {
      providerId: config.providerId,
      baseUrl: resolveBaseUrl(config),
      model: resolveModel(config),
      apiKey: resolveApiKey(config),
      text: input.text,
      style: input.style,
      target: input.target,
      instruction: input.instruction ?? '',
      context: input.context ?? ''
    }
  });
}

export async function requestAiModels(config: AiConfig): Promise<ApiResult<{ models: string[] }>> {
  return apiFetch<{ models: string[] }>('/api/ai/models', {
    method: 'POST',
    auth: false,
    timeout: 30_000,
    body: {
      providerId: config.providerId,
      baseUrl: resolveBaseUrl(config),
      apiKey: resolveApiKey(config)
    }
  });
}