import { readonly, ref } from 'vue';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  /** 可手动关闭的常驻提示 */
  persistent?: boolean;
  /** 剪贴板失败等场景：展示可选择的原始文本 */
  selectableText?: string;
}

const items = ref<ToastItem[]>([]);
let seq = 0;

function push(tone: ToastTone, message: string, options: { duration?: number; selectableText?: string } = {}) {
  seq += 1;
  const id = seq;
  const duration = options.duration ?? (tone === 'error' ? 5000 : 3000);

  items.value = [...items.value, { id, tone, message, selectableText: options.selectableText }];

  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
}

function dismiss(id: number) {
  items.value = items.value.filter((item) => item.id !== id);
}

function clear() {
  items.value = [];
}

/**
 * 全局 Toast。
 *
 * 状态放在模块作用域，任意组件（含 store 外部逻辑）都能调用，
 * 由 `<ToastHost />` 在 App 根部渲染。
 */
export function useToast() {
  return {
    items: readonly(items),
    dismiss,
    clear,
    success: (message: string, options?: { duration?: number }) => push('success', message, options),
    error: (message: string, options?: { duration?: number }) => push('error', message, options),
    info: (message: string, options?: { duration?: number }) => push('info', message, options),
    /** 复制失败等需要用户手动复制的场景 */
    copyFallback: (message: string, text: string) =>
      push('error', message, { duration: 0, selectableText: text })
  };
}
