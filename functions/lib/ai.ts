/**
 * AI 改写网关（T5.7）。
 *
 * 为什么由服务端转发而不是浏览器直连厂商：
 * 1. 站点 CSP 是 `connect-src 'self'`，浏览器根本发不出去（这条规则同时也是
 *    「页面不会偷偷把简历发到第三方」的技术保证，不该为这个功能拆掉）；
 * 2. 大多数厂商不返回 CORS 头，直连本来就不可行；
 * 3. 密钥只在这一次请求里出现，服务端**不留存、不落库、不写日志**。
 *
 * 因此这里的职责非常窄：校验参数 → 拼提示词 → 转发 → 把上游的响应/错误
 * 翻译成本站统一的 `{ code, message, data }`。
 */

import { AI_LIMITS, CUSTOM_PROVIDER_ID, findAiProvider, findRewriteStyle } from '../../shared/ai';

/**
 * 我们回给前端的 HTTP 状态。
 *
 * 刻意**不含 401**：`src/utils/http.ts` 把 401 统一当作「登录态失效」处理，
 * 会触发登出跳转。而「API Key 无效」是用户自己的 Key 有问题，与他的账号无关，
 * 用 502 表达才不会把一个设置错误升级成「莫名其妙被踢下线」。
 */
export type AiErrorStatus = 400 | 429 | 502 | 504;

export interface AiUpstreamError {
  code: number;
  /** HTTP 状态码，由路由层直接使用 */
  status: AiErrorStatus;
  message: string;
}

/** 统一的失败构造：路由层只负责 `c.json({ code, message, data: null }, status)` */
function fail(code: number, status: AiErrorStatus, message: string): AiUpstreamError {
  return { code, status, message };
}

// ---------------------------------------------------------------------------
// 1. 自定义厂商的 base URL 校验（SSRF 防线）
// ---------------------------------------------------------------------------

/**
 * 私有 / 保留地址。用户能自定义 base URL，就等于能让我们替他发请求 ——
 * 不设防的话，`https://169.254.169.254/` 这类地址就成了「用我们的服务器
 * 读云厂商元数据」的工具。预设厂商的地址写死在 `shared/ai.ts` 里，
 * 只对自定义地址做这层校验。
 */
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(?:1[6-9]|2\d|3[01])\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /\.local$/i,
  /\.internal$/i,
  /\.localhost$/i
];

export interface BaseUrlCheck {
  ok: boolean;
  /** 规范化后的 base URL（去掉末尾斜杠） */
  url: string;
  reason?: string;
}

/**
 * 校验并规范化 base URL。
 *
 * 只允许 https：明文 http 会把用户的 API Key 暴露给链路上任何一环。
 * 自建的内网服务（Ollama、公司网关）因此无法使用 —— 这是有意的取舍：
 * 那类服务本来就只在你自己的机器上，我们的服务器也未必够得着，
 * 真正需要的是「别让我们变成别人的跳板」。
 */
export function validateBaseUrl(raw: unknown, providerId: string): BaseUrlCheck {
  /*
   * 预设厂商先走白名单，**整个忽略客户端传来的地址**。
   * 顺序不能反：反过来的话，「预设厂商 + 空地址」会被判成参数错误，
   * 而客户端本就不需要为预设厂商提供地址（地址在我们自己的表里）。
   */
  if (providerId !== CUSTOM_PROVIDER_ID) {
    const preset = findAiProvider(providerId);
    if (!preset) return { ok: false, url: '', reason: '未知的模型厂商' };
    if (!preset.baseUrl) return { ok: false, url: '', reason: '该厂商需要自己填写接口地址' };
    return { ok: true, url: preset.baseUrl };
  }

  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return { ok: false, url: '', reason: '接口地址不能为空' };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, url: '', reason: '接口地址格式不正确（需形如 https://example.com/v1）' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, url: '', reason: '接口地址必须使用 https' };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, url: '', reason: '接口地址里不要带用户名或密码' };
  }
  if (parsed.search || parsed.hash) {
    return { ok: false, url: '', reason: '接口地址里不要带查询参数或锚点' };
  }

  const host = parsed.hostname;
  if (!host || !host.includes('.') && !host.startsWith('[')) {
    return { ok: false, url: '', reason: '接口地址需要是完整的域名' };
  }
  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
    return { ok: false, url: '', reason: '接口地址指向内网或本机，不被允许' };
  }

  // 去掉末尾斜杠：后面统一按 `${base}/chat/completions` 拼接
  const normalized = parsed.origin + parsed.pathname.replace(/\/+$/, '');
  return { ok: true, url: normalized };
}

/** 把 base URL 拼成具体端点；`path` 形如 `/chat/completions` */
export function joinEndpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

// ---------------------------------------------------------------------------
// 2. 提示词
// ---------------------------------------------------------------------------

/**
 * 系统提示词。
 *
 * 第 1 条「不得编造事实」是这个功能能不能上的前提：简历是会被面试官
 * 逐条追问的东西，模型顺手补一个「提升 30%」就可能让人当场露馅。
 * 第 2 条给出了「确实缺数据」时的正确出口（占位符），否则模型只有
 * 「编一个」和「什么都不写」两个选择 —— 前者有害，后者等于没改写。
 */
const SYSTEM_PROMPT = [
  '你是一位资深的中文简历编辑，只做文字层面的改写，不做任何事实层面的补充。',
  '',
  '必须遵守的约束（违反任意一条即为不合格）：',
  '1. 不得编造事实：原文没有出现的公司、职位、技术栈、数字、时间、奖项，一个字都不能添加。',
  '2. 原文缺少量化数据时，用 [请补充具体数据] 这样的方括号占位符标出该填的位置，不要自己填数字。',
  '3. 只输出改写后的正文本身：不要解释改了什么、不要加标题、不要用引号或 Markdown 代码块包裹。',
  '4. 输入是几行，输出就是几行；一行一条要点，不要把多条合并成一段。',
  '5. 使用简历惯用的无主语句式（省略「我」），不要出现「贵公司」「本人」这类信函用语。',
  '6. 除风格明确要求外，与原文语言保持一致；技术名词、产品名保留原文写法（如 Vue3、K8s）。'
].join('\n');

/** 每种风格追加在系统提示词后面的一句操作指令 */
const STYLE_INSTRUCTIONS: Record<string, string> = {
  polish:
    '本次风格：润色通顺。修掉病句、重复和口语化表达，信息量一条都不能少，长度与原文接近。',
  concise:
    '本次风格：精简压缩。删掉形容词堆砌与「负责了」「进行了」这类虚词，同样的事实用更少的字说清，目标压缩到原文的 60%–70%。',
  quantify:
    '本次风格：突出成果。把结果和影响前置，过程后置。原文已有的数字必须保留；没有数字的地方按约束 2 插入占位符，让人一眼看出该补什么。',
  star: '本次风格：STAR 结构。把每条要点按「背景与任务 → 采取的行动 → 结果」的顺序重排成一句连贯的话，不要写成四段。',
  professional:
    '本次风格：专业措辞。「负责 / 参与 / 协助 / 配合」这类描述过程的动词换成「主导 / 搭建 / 重构 / 推动 / 落地」这类指向结果的动词，措辞向技术岗位的书面表达靠拢。',
  fix: '本次风格：纠错校对。只修错别字、标点、术语大小写和语法错误；句子结构、用词习惯、行数一律保持原样。',
  'translate-en':
    '本次风格：译为英文。使用英文简历惯用的动词开头短句与专业表达，技术名词保留通用写法，不要逐字直译中文成语或口号式表述。'
};

export interface RewritePromptInput {
  text: string;
  style: string;
  target: string;
  /** 用户自填的额外要求 */
  instruction?: string;
  /** 目标岗位背景（用户可选粘贴） */
  context?: string;
}

/** 目标类型对应的身份说明 —— 「技能列表」和「工作经历」的改写法完全不同 */
const TARGET_LABELS: Record<string, string> = {
  summary: '个人简介 / 自我评价',
  work: '一段工作经历的工作内容描述',
  project: '一段项目经历的项目描述',
  skills: '技能列表',
  custom: '简历中的一段文字'
};

export function buildRewriteMessages(input: RewritePromptInput): Array<{
  role: 'system' | 'user';
  content: string;
}> {
  const styleRule = STYLE_INSTRUCTIONS[input.style] ?? '';
  const targetLabel = TARGET_LABELS[input.target] ?? TARGET_LABELS.custom;

  const userParts: string[] = [
    `下面这段内容属于：${targetLabel}。`,
  ];

  if (input.context?.trim()) {
    userParts.push(`目标岗位背景（仅供参考，不要在改写中引入其中没有出现在原文里的经历）：\n${input.context.trim()}`);
  }
  if (input.instruction?.trim()) {
    userParts.push(`用户的额外要求：${input.instruction.trim()}`);
  }

  userParts.push(`原文：\n<<<\n${input.text}\n>>>`);
  userParts.push('直接输出改写后的正文。');

  return [
    { role: 'system', content: [SYSTEM_PROMPT, styleRule].filter(Boolean).join('\n\n') },
    { role: 'user', content: userParts.join('\n\n') }
  ];
}

// ---------------------------------------------------------------------------
// 3. 调用上游
// ---------------------------------------------------------------------------

export interface ChatCallInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  maxTokens?: number;
}

/**
 * 解析上游响应体里的正文。
 *
 * 只认 OpenAI 的 `choices[0].message.content`。这个字段是兼容协议的公约数，
 * 却仍有两种形态：字符串（绝大多数），或 `[{type:'text',text}]` 数组
 * （部分聚合网关的原生多模态格式）。两种都接住，其余一律当解析失败，
 * 而不是猜一个字段名 —— 猜错会把 400 错误当成「改写结果」写进简历。
 */
export function parseChatContent(payload: any): string | null {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part: any) => (typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : ''))
      .join('');
    return text || null;
  }
  return null;
}

/**
 * 清洗模型输出。
 *
 * 训练数据里「改写结果」几乎总是被 ``` 包着或被加上「改写后的内容：」，
 * 提示词拦不住全部。这些残留物写进简历就是要用户手动删的噪音，
 * 在这里一次清掉比让用户自己发现更可靠。
 */
export function normalizeRewriteOutput(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n').trim();

  // 整体被代码块包裹
  const fence = /^```[a-zA-Z]*\n([\s\S]*?)\n?```$/.exec(text);
  if (fence) text = fence[1].trim();

  // 开头的引导语，如「改写后的内容：」「以下是改写结果：」
  text = text.replace(/^(?:改写后(?:的)?(?:内容|结果|版本)|改写结果|以下是改写(?:后)?(?:的)?(?:内容|结果|版本))\s*[:：]?\s*\n?/, '');

  // 结尾的补充说明，如「（以上为改写结果）」
  text = text.replace(/\n*(?:以上|希望)[^\n]{0,40}$/, (match) => (/(?:改写|结果|帮助|满意)/.test(match) ? '' : match));

  // 三条以上连续空行压成一条，避免带进多余留白
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/** 上游返回的错误信息，取最贴近用户的那一句 */
function upstreamMessage(payload: any): string {
  const candidates = [
    payload?.error?.message,
    payload?.error?.code,
    payload?.message,
    payload?.msg,
    payload?.error_msg
  ];
  const found = candidates.find((value) => typeof value === 'string' && value.trim());
  return typeof found === 'string' ? found.trim().slice(0, 200) : '';
}

/**
 * 把上游的失败翻译成用户能据此行动的文案。
 *
 * 401/403 与 404 要分开：前者是「Key 不对」，后者是「地址或模型名不对」，
 * 用户改的东西完全不同。混成「调用失败」等于让他自己猜。
 */
export function mapUpstreamError(status: number, payload: any): AiUpstreamError {
  const detail = upstreamMessage(payload);
  const suffix = detail ? `（服务商返回：${detail}）` : '';

  if (status === 401 || status === 403) {
    return fail(50201, 502, `API Key 无效，或没有该模型的调用权限${suffix}`);
  }
  if (status === 404) {
    return fail(50202, 502, `接口地址或模型名不存在，请检查设置里的这两项${suffix}`);
  }
  if (status === 429) {
    return fail(50203, 502, `服务商限流了，或账户余额不足，请稍后再试${suffix}`);
  }
  if (status === 400 || status === 422) {
    return fail(50204, 502, detail ? `服务商拒绝了这次请求：${detail}` : '服务商拒绝了这次请求，可能是模型不支持该用法');
  }
  return fail(50205, 502, `服务商接口返回 ${status}${suffix}`);
}

interface CallOutcome {
  ok: true;
  text: string;
  /** 上游返回的 token 用量，仅用于日志观测，不入库 */
  usage?: { prompt?: number; completion?: number };
}

export type CallResult = CallOutcome | { ok: false; error: AiUpstreamError };

/** 统一的上游请求头 */
function upstreamHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  };
}

/**
 * 调一次 chat/completions。
 *
 * `redirect: 'manual'`：自定义 base URL 已挡掉内网地址，但如果放行重定向，
 * 对方仍可用一个公网域名 302 到 `169.254.169.254` 绕过校验。3xx 一律当失败。
 */
export async function callChatCompletion(input: ChatCallInput): Promise<CallResult> {
  const url = joinEndpoint(input.baseUrl, '/chat/completions');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: upstreamHeaders(input.apiKey),
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        temperature: 0.3,
        max_tokens: input.maxTokens ?? AI_LIMITS.maxOutputTokens,
        stream: false
      }),
      redirect: 'manual',
      signal: AbortSignal.timeout(AI_LIMITS.timeoutMs)
    });
  } catch (err) {
    const timedOut = err instanceof Error && /abort|timeout/i.test(err.name + err.message);
    return {
      ok: false,
      error: fail(
        50206,
        504,
        timedOut
          ? `等待服务商超过 ${Math.round(AI_LIMITS.timeoutMs / 1000)} 秒，已中止`
          : '无法连接到该接口地址，请检查地址是否正确'
      )
    };
  }

  const payload: any = await response.json().catch(() => null);

  if (response.status >= 300 && response.status < 400) {
    return { ok: false, error: fail(50207, 502, '接口地址返回了跳转，出于安全考虑不予跟随') };
  }
  if (!response.ok) {
    return { ok: false, error: mapUpstreamError(response.status, payload) };
  }

  const content = parseChatContent(payload);
  if (!content) {
    return { ok: false, error: fail(50208, 502, '服务商返回的内容无法识别，请确认该模型支持对话接口') };
  }

  const text = normalizeRewriteOutput(content);
  if (!text) {
    return { ok: false, error: fail(50208, 502, '服务商返回了空内容，请换个模型或稍后重试') };
  }
  if (text.length > AI_LIMITS.maxOutputChars) {
    return {
      ok: false,
      error: fail(50209, 502, `服务商返回的内容超过 ${AI_LIMITS.maxOutputChars} 字，已丢弃（请缩短原文后重试）`)
    };
  }

  return {
    ok: true,
    text,
    usage: {
      prompt: Number(payload?.usage?.prompt_tokens) || undefined,
      completion: Number(payload?.usage?.completion_tokens) || undefined
    }
  };
}

/**
 * 拉取厂商的模型列表。
 *
 * 厂商改名很勤（`glm-4-plus` → `glm-5`、`moonshot-v1-8k` → `kimi-k2`），
 * 预设里写死的名字半年就会过期。有了这个接口，用户不必等我们更新代码。
 * 不支持 `/models` 的厂商返回空数组即可，不当作错误 —— 手填模型名一直是可用的。
 */
export async function fetchModelList(baseUrl: string, apiKey: string): Promise<{ ok: true; models: string[] } | { ok: false; error: AiUpstreamError }> {
  const url = joinEndpoint(baseUrl, '/models');

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: upstreamHeaders(apiKey),
      redirect: 'manual',
      signal: AbortSignal.timeout(20_000)
    });
  } catch {
    return { ok: false, error: fail(50206, 504, '无法连接到该接口地址，请检查地址是否正确') };
  }

  if (!response.ok) {
    return { ok: false, error: mapUpstreamError(response.status, await response.json().catch(() => null)) };
  }

  const payload: any = await response.json().catch(() => null);
  const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
  const models = list
    .map((item: any) => (typeof item === 'string' ? item : item?.id ?? item?.name))
    .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    .sort((a: string, b: string) => a.localeCompare(b))
    .slice(0, 200);

  return { ok: true, models };
}

// ---------------------------------------------------------------------------
// 4. 请求参数校验
// ---------------------------------------------------------------------------

export interface RewriteRequest {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  text: string;
  style: string;
  target: string;
  instruction?: string;
  context?: string;
}

export type ValidationResult = { ok: true; value: RewriteRequest } | { ok: false; error: AiUpstreamError };

const MAX_MODEL_LENGTH = 120;
const MAX_KEY_LENGTH = 400;

/**
 * 校验改写请求。
 *
 * 逐项给出具体原因而不是一句「参数错误」：这个表单有五个字段，用户需要
 * 知道改哪一个。所有长度上限都取自 `AI_LIMITS`，与前端提示同源。
 */
export function validateRewriteRequest(body: Record<string, any>): ValidationResult {
  const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
  if (!findAiProvider(providerId)) {
    return { ok: false, error: fail(40008, 400, '未知的模型厂商，请在设置里重新选择') };
  }

  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!apiKey) return { ok: false, error: fail(40009, 400, '请先填写该厂商的 API Key') };
  if (apiKey.length > MAX_KEY_LENGTH) {
    return { ok: false, error: fail(40009, 400, 'API Key 长度异常，请检查是否复制了多余内容') };
  }

  const model = typeof body.model === 'string' ? body.model.trim() : '';
  if (!model) return { ok: false, error: fail(40008, 400, '请填写要调用的模型名') };
  if (model.length > MAX_MODEL_LENGTH) {
    return { ok: false, error: fail(40008, 400, '模型名过长') };
  }

  const baseUrlCheck = validateBaseUrl(body.baseUrl, providerId);
  if (!baseUrlCheck.ok) return { ok: false, error: fail(40010, 400, baseUrlCheck.reason || '接口地址不被允许') };

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return { ok: false, error: fail(40008, 400, '没有可改写的内容') };
  if (text.length > AI_LIMITS.maxInputChars) {
    return {
      ok: false,
      error: fail(40008, 400, `原文超过 ${AI_LIMITS.maxInputChars} 字，请分段改写`)
    };
  }

  const style = typeof body.style === 'string' ? body.style.trim() : '';
  if (!findRewriteStyle(style)) return { ok: false, error: fail(40008, 400, '未知的改写风格') };
  if (style === 'translate-en' && text.length > AI_LIMITS.maxInputChars) {
    return { ok: false, error: fail(40008, 400, '内容过长，翻译容易失真，请分段进行') };
  }

  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
  if (instruction.length > AI_LIMITS.maxInstructionChars) {
    return {
      ok: false,
      error: fail(40008, 400, `补充要求超过 ${AI_LIMITS.maxInstructionChars} 字，请精简后再试`)
    };
  }

  const context = typeof body.context === 'string' ? body.context.trim() : '';
  if (context.length > AI_LIMITS.maxContextChars) {
    return {
      ok: false,
      error: fail(40008, 400, `岗位背景超过 ${AI_LIMITS.maxContextChars} 字，粘贴关键要求即可`)
    };
  }

  return {
    ok: true,
    value: {
      providerId,
      baseUrl: baseUrlCheck.url,
      apiKey,
      model,
      text,
      style,
      target: typeof body.target === 'string' ? body.target : 'custom',
      instruction,
      context
    }
  };
}

/** `POST /api/ai/models` 的请求体校验 */
export function validateModelListRequest(
  body: Record<string, any>
): { ok: true; value: { baseUrl: string; apiKey: string } } | { ok: false; error: AiUpstreamError } {
  const providerId = typeof body.providerId === 'string' ? body.providerId.trim() : '';
  if (!findAiProvider(providerId)) {
    return { ok: false, error: fail(40008, 400, '未知的模型厂商，请在设置里重新选择') };
  }

  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!apiKey) return { ok: false, error: fail(40009, 400, '请先填写该厂商的 API Key') };
  if (apiKey.length > MAX_KEY_LENGTH) {
    return { ok: false, error: fail(40009, 400, 'API Key 长度异常，请检查是否复制了多余内容') };
  }

  const baseUrlCheck = validateBaseUrl(body.baseUrl, providerId);
  if (!baseUrlCheck.ok) return { ok: false, error: fail(40010, 400, baseUrlCheck.reason || '接口地址不被允许') };

  return { ok: true, value: { baseUrl: baseUrlCheck.url, apiKey } };
}