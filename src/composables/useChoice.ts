import { readonly, ref } from 'vue';

export interface ChoiceOption {
  value: string;
  label: string;
  description?: string;
  /** primary 用于推荐项，其余为次要样式 */
  tone?: 'primary' | 'secondary';
}

export interface ChoiceOptions {
  title: string;
  description?: string;
  options: ChoiceOption[];
}

interface ChoiceState extends ChoiceOptions {
  id: number;
}

const state = ref<ChoiceState | null>(null);
let resolver: ((value: string | null) => void) | null = null;
let seq = 0;

/**
 * 多选项决策框（`askConfirm` 的扩展版）。
 *
 * 用于「登录后本地草稿怎么办」这类需要三个以上选项、且每个选项都要解释后果的场景。
 * 关掉弹窗或按 Esc 返回 `null`，调用方应当把 `null` 当成「不改动现状」。
 */
export function askChoice(options: ChoiceOptions): Promise<string | null> {
  // 上一个未关闭的选择框视为放弃，避免 promise 悬挂
  resolver?.(null);

  seq += 1;
  state.value = { ...options, id: seq };

  return new Promise<string | null>((resolve) => {
    resolver = resolve;
  });
}

export function resolveChoice(value: string | null) {
  const current = resolver;
  resolver = null;
  state.value = null;
  current?.(value);
}

export function useChoiceState() {
  return readonly(state);
}
