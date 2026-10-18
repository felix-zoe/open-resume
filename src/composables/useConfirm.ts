import { readonly, ref } from 'vue';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'default' | 'danger';
}

interface ConfirmState extends Required<Omit<ConfirmOptions, 'description'>> {
  description?: string;
}

const state = ref<ConfirmState | null>(null);
let resolver: ((value: boolean) => void) | null = null;

/**
 * Promise 化的确认框（替代原生 `confirm`）。
 *
 * 命名用 `askConfirm` 而不是 `confirm`，避免与 window.confirm 混淆，
 * 也让静态守卫能简单排除。
 */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  // 前一个确认框未关闭时视为取消，避免 promise 悬挂
  resolver?.(false);

  state.value = {
    title: options.title,
    description: options.description,
    confirmText: options.confirmText ?? '确认',
    cancelText: options.cancelText ?? '取消',
    tone: options.tone ?? 'default'
  };

  return new Promise<boolean>((resolve) => {
    resolver = resolve;
  });
}

export function resolveConfirm(value: boolean) {
  const current = resolver;
  resolver = null;
  state.value = null;
  current?.(value);
}

export function useConfirmState() {
  return readonly(state);
}
