/**
 * 版本快照策略。
 *
 * 旧实现每 3 分钟无条件写一份全量快照，结果是同一天的编辑会堆出几十条
 * 内容完全相同的记录，用户点开「历史版本」看到的是一堆看不出差别的条目。
 *
 * 新策略两条判据，缺一不可：
 * 1. **内容哈希变了** —— 没有改动就不写；
 * 2. **距上次快照 ≥ 10 分钟** —— 连续输入不会把时间线刷满。
 *
 * 手动保存（`source: 'manual'`）不受时间间隔限制，但仍然跳过完全相同的哈希。
 */

/** 自动快照的最小间隔：10 分钟 */
export const VERSION_MIN_INTERVAL_SECONDS = 10 * 60;

/** 每份简历保留的版本数 */
export const VERSION_KEEP_LIMIT = 20;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * 简历内容哈希。
 *
 * 只对「会影响呈现」的字段做哈希：title / templateId / content / themeConfig。
 * 刻意不包含 `updatedAt` 之类的元数据 —— 否则每次保存都会得到新哈希，
 * 内容判重就失效了。
 *
 * key 排序后再序列化：对象字面量的键顺序在不同构造路径下可能不同，
 * 不排序会让「内容相同但键序不同」被误判为有改动。
 */
export async function hashResumeSnapshot(snapshot: {
  title?: string;
  templateId?: string;
  content?: unknown;
  themeConfig?: unknown;
}): Promise<string> {
  const payload = stableStringify({
    title: snapshot.title ?? '',
    templateId: snapshot.templateId ?? '',
    content: snapshot.content ?? {},
    themeConfig: snapshot.themeConfig ?? {}
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return toHex(new Uint8Array(digest)).slice(0, 32);
}

/** 键排序的 JSON 序列化，保证同一内容得到同一字符串 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

/** 估算字数：中文按字、英文按词，用于版本列表里给用户一个体量参考 */
export function countWords(content: any): number {
  if (!content || typeof content !== 'object') return 0;
  const chunks: string[] = [];
  const profile = content.profile ?? {};
  for (const key of ['name', 'title', 'summary']) {
    if (typeof profile[key] === 'string') chunks.push(profile[key]);
  }
  const modules = content.modules ?? {};
  for (const mod of Object.values<any>(modules)) {
    if (Array.isArray(mod?.items)) {
      for (const item of mod.items) {
        if (typeof item === 'string') chunks.push(item);
        else if (item && typeof item === 'object') {
          for (const v of Object.values(item)) if (typeof v === 'string') chunks.push(v);
        }
      }
    }
  }
  const text = chunks.join(' ');
  // 中日韩字符逐字计数，其余按空白分词
  const cjk = (text.match(/[一-龥]/g) || []).length;
  const latin = text.replace(/[一-龥]/g, ' ').split(/\s+/).filter(Boolean).length;
  return cjk + latin;
}

export interface ShouldSnapshotInput {
  /** 本次内容的哈希 */
  hash: string;
  /** 最近一次快照的哈希，没有则为 null */
  lastHash: string | null;
  /** 最近一次快照的时间戳（秒），没有则为 null */
  lastCreatedAt: number | null;
  nowSeconds: number;
  /** manual 手动保存不受时间间隔限制 */
  source?: 'auto' | 'manual';
}

export interface SnapshotDecision {
  write: boolean;
  reason?: 'unchanged' | 'too-soon';
}

/** 判断本次保存是否需要写快照 */
export function shouldWriteVersion(input: ShouldSnapshotInput): SnapshotDecision {
  if (input.lastHash && input.lastHash === input.hash) {
    return { write: false, reason: 'unchanged' };
  }
  if (
    input.source !== 'manual' &&
    input.lastCreatedAt !== null &&
    input.nowSeconds - input.lastCreatedAt < VERSION_MIN_INTERVAL_SECONDS
  ) {
    return { write: false, reason: 'too-soon' };
  }
  return { write: true };
}
