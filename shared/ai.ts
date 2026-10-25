// AI 改写（T5.7）的前后端共享契约。
//
// 只放「两边都必须知道」的东西：厂商预设、改写风格、硬性上限。
// **提示词不在这里** —— 它是服务端的实现细节，前端既不需要知道，
// 也不该让它出现在构建产物里（那等于把模板公开发给所有人抄）。
//
// 与 `shared/types.ts` 同样只放纯类型与常量，不 import 任何运行时依赖。

/**
 * 一个厂商的接入预设。
 *
 * 全部走 OpenAI 兼容协议（`POST {baseUrl}/chat/completions`）：国内主流厂商
 * 现在都有这个端点，一套代码就能覆盖，不必为每家写一个适配器。
 * 唯一没覆盖的是非文本模态，我们也不需要。
 */
export interface AiProviderPreset {
  id: string;
  name: string;
  /** 接口前缀。实际请求的是 `{baseUrl}/chat/completions` */
  baseUrl: string;
  /** 推荐模型。各厂模型名变动频繁，界面上始终可改 */
  defaultModel: string;
  /** 下拉候选模型，仅作输入提示，不限制用户手填 */
  models: string[];
  /** 申请 API Key 的页面 */
  keyUrl: string;
  /** 该厂商特有的坑，直接显示在设置表单里 */
  note?: string;
}

/**
 * 国内主流厂商预设。
 *
 * 模型名会随厂商升级换代，这里的值只是「填进去大概率能跑」的起点：
 * 用户可以改，也可以用「拉取模型列表」从厂商自己那拿一份实时清单。
 * 因此这里的准确性只影响首次体验，不影响功能可用性。
 */
export const AI_PROVIDERS: AiProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek 深度求索',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    keyUrl: 'https://platform.deepseek.com/api_keys',
    note: '国内可直连，中文简历改写性价比最高的一档。'
  },
  {
    id: 'dashscope',
    name: '阿里云百炼（通义千问）',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long'],
    keyUrl: 'https://bailian.console.aliyun.com/',
    note: '若开通了业务空间专属域名，把上面的地址换成控制台里给出的那个。'
  },
  {
    id: 'zhipu',
    name: '智谱 AI（GLM）',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
    models: ['glm-4-flash', 'glm-4-air', 'glm-4-plus'],
    keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    note: '注意 base URL 里已含 `/api/paas/v4`，不要再补 `/v1`。'
  },
  {
    id: 'moonshot',
    name: '月之暗面 Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    keyUrl: 'https://platform.moonshot.cn/console/api-keys'
  },
  {
    id: 'ark',
    name: '火山方舟（豆包）',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: '',
    models: [],
    keyUrl: 'https://console.volcengine.com/ark',
    note: '模型一栏要填控制台里的「接入点 ID」（形如 ep-xxxxxxxx），不是模型名。'
  },
  {
    id: 'qianfan',
    name: '百度千帆（文心）',
    baseUrl: 'https://qianfan.baidubce.com/v2',
    defaultModel: 'ernie-4.0-8k-latest',
    models: ['ernie-4.0-8k-latest', 'ernie-4.0-turbo-8k', 'ernie-speed-128k'],
    keyUrl: 'https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application',
    note: 'V2 接口用 API Key（`bce-v3/...`）鉴权，不再用 AK/SK。'
  },
  {
    id: 'hunyuan',
    name: '腾讯混元',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    defaultModel: 'hunyuan-turbos-latest',
    models: ['hunyuan-turbos-latest', 'hunyuan-standard', 'hunyuan-lite'],
    keyUrl: 'https://console.cloud.tencent.com/hunyuan/api-key'
  },
  {
    id: 'spark',
    name: '讯飞星火',
    baseUrl: 'https://spark-api-open.xf-yun.com/v1',
    defaultModel: 'generalv3.5',
    models: ['generalv3.5', 'generalv3', '4.0Ultra', 'lite'],
    keyUrl: 'https://console.xfyun.cn/services/bm35',
    note: '模型填接口标识（如 generalv3.5），不是「星火 Max」这类展示名。'
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
    models: ['Qwen/Qwen2.5-7B-Instruct', 'deepseek-ai/DeepSeek-V3'],
    keyUrl: 'https://cloud.siliconflow.cn/account/ak',
    note: '聚合平台，一个 Key 可调多家开源模型，部分模型免费。模型名形如「厂牌/模型」。'
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    baseUrl: 'https://api.minimax.chat/v1',
    defaultModel: 'abab6.5s-chat',
    models: ['abab6.5s-chat', 'abab6.5-chat'],
    keyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key'
  },
  {
    id: 'stepfun',
    name: '阶跃星辰 StepFun',
    baseUrl: 'https://api.stepfun.com/v1',
    defaultModel: 'step-1-8k',
    models: ['step-1-8k', 'step-1-32k', 'step-2-16k'],
    keyUrl: 'https://platform.stepfun.com/interface-key'
  },
  {
    id: 'baichuan',
    name: '百川智能',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    defaultModel: 'Baichuan4',
    models: ['Baichuan4', 'Baichuan3-Turbo'],
    keyUrl: 'https://platform.baichuan-ai.com/console/apikey'
  },
  {
    id: 'custom',
    name: '自定义（OpenAI 兼容）',
    baseUrl: '',
    defaultModel: '',
    models: [],
    keyUrl: '',
    note: '任何 OpenAI 兼容端点都行：自建网关、公司内网代理、Ollama、vLLM、One-API 等。'
  }
];

/** 自定义厂商的固定 id —— 服务端据此放宽 base URL 校验 */
export const CUSTOM_PROVIDER_ID = 'custom';

export const AI_PROVIDER_IDS = AI_PROVIDERS.map((provider) => provider.id);

export function findAiProvider(id: string): AiProviderPreset | undefined {
  return AI_PROVIDERS.find((provider) => provider.id === id);
}

/**
 * 改写风格。
 *
 * 每一种对应服务端一条固定的提示词；`custom` 之外都只改措辞，
 * **不允许编造事实** —— 这条约束写死在系统提示词里，不交给风格定义。
 */
export const AI_REWRITE_STYLES = [
  {
    id: 'polish',
    label: '润色通顺',
    hint: '改掉病句与口水话，信息一字不减'
  },
  {
    id: 'concise',
    label: '精简压缩',
    hint: '删冗余修饰，同样的事用更少的字说清'
  },
  {
    id: 'quantify',
    label: '突出成果',
    hint: '把结果前置，缺数据处标出待补的占位'
  },
  {
    id: 'star',
    label: 'STAR 结构',
    hint: '按「背景—任务—行动—结果」重排一句话'
  },
  {
    id: 'professional',
    label: '专业措辞',
    hint: '弱动词换强动词，去掉「负责 / 参与」'
  },
  {
    id: 'fix',
    label: '纠错校对',
    hint: '只修错别字、标点与语病，其余保持原样'
  },
  {
    id: 'translate-en',
    label: '译成英文',
    hint: '译成简历常用的英文表达，保留技术名词'
  }
] as const;

export type AiRewriteStyle = (typeof AI_REWRITE_STYLES)[number]['id'];

export const AI_REWRITE_STYLE_IDS = AI_REWRITE_STYLES.map((style) => style.id);

export function findRewriteStyle(id: string) {
  return AI_REWRITE_STYLES.find((style) => style.id === id);
}

/**
 * 硬性上限。服务端与前端各自用一份，两边都不放宽。
 *
 * 成本由用户自己承担（用的是他自己的 Key），但「一次点错把整份简历发出去」
 * 和「上游返回一坨没用的东西覆盖掉正文」是必须挡住的。
 */
export const AI_LIMITS = {
  /** 单次送出的原文上限（字符）。一条经历通常 200 字内，2000 足以覆盖 */
  maxInputChars: 2000,
  /** 自定义要求上限 */
  maxInstructionChars: 300,
  /** 期望生成上限（token），用来把单次成本钉住 */
  maxOutputTokens: 1200,
  /** 上游请求超时（毫秒） */
  timeoutMs: 45_000,
  /** 采纳前的返回文本上限（字符），超长视为异常而不是「写得好」 */
  maxOutputChars: 6000,
  /** 可选的补充上下文（目标岗位 JD 摘要）上限 */
  maxContextChars: 600
} as const;

/** 改写目标类型：决定服务端往提示词里放什么身份说明 */
export const AI_REWRITE_TARGETS = ['summary', 'work', 'project', 'skills', 'custom'] as const;
export type AiRewriteTarget = (typeof AI_REWRITE_TARGETS)[number];