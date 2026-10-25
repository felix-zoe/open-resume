import { computed, getCurrentInstance, onBeforeUnmount, shallowRef, watch, type Ref } from 'vue';

/**
 * 撤销 / 重做。
 *
 * 设计要点：
 * - 监听的是整个可编辑状态（内容 + 主题 + 标题 + 模板），而不是单个输入框，
 *   因为用户眼里的“撤销”是撤销刚才那次操作，不区分改的是哪一块；
 * - 500ms 内连续变更合并成一个快照，否则每敲一个字都进栈，撤销一次只退一格；
 * - 栈上限 50，避免长会话把内存吃满；
 * - 外部加载（云端/本地草稿）时清空栈，否则会撤回到上一份简历的内容。
 */

export interface UndoRedoOptions<T> {
  /** 每次快照要记录的状态；返回一个可结构化克隆的对象 */
  snapshot: () => T;
  /** 应用某个快照 */
  restore: (snapshot: T) => void;
  /** 参与监听的响应式来源 */
  sources: Array<Ref<unknown>>;
  /** 合并窗口（毫秒） */
  mergeWindow?: number;
  /** 栈上限 */
  limit?: number;
}

export interface UndoRedoApi {
  undo: () => boolean;
  redo: () => boolean;
  canUndo: Ref<boolean>;
  canRedo: Ref<boolean>;
  /** 清空历史（加载了另一份简历后调用） */
  reset: () => void;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function useUndoRedo<T>(options: UndoRedoOptions<T>): UndoRedoApi {
  const mergeWindow = options.mergeWindow ?? 500;
  const limit = options.limit ?? 50;

  // shallowRef：快照本身已是深拷贝，不需要 Vue 再递归代理，也避免类型被 UnwrapRef 改写
  const past = shallowRef<T[]>([]);
  const future = shallowRef<T[]>([]);
  const canUndo = computed(() => past.value.length > 0);
  const canRedo = computed(() => future.value.length > 0);

  let lastSnapshot: T = clone(options.snapshot());
  let lastPushAt = 0;
  /** 正在应用历史状态时，不要把它当成一次新的用户编辑 */
  let isRestoring = false;

  function pushHistory() {
    if (isRestoring) return;

    const next = clone(options.snapshot());
    const now = Date.now();
    const withinMergeWindow = now - lastPushAt < mergeWindow && past.value.length > 0;

    // 合并窗口内：栈顶已经是“这一串连续输入之前”的状态，什么都不用做。
    // 若此时再压入 lastSnapshot（= 上一次按键后的状态），撤销就只能退一格。
    if (!withinMergeWindow) {
      // shallowRef 不追踪数组内部变更，必须整体替换数组
      const nextPast = [...past.value, lastSnapshot];
      if (nextPast.length > limit) nextPast.shift();
      past.value = nextPast;
      // 新编辑发生后，原来的重做分支就失效了
      future.value = [];
    }

    lastSnapshot = next;
    lastPushAt = now;
  }

  watch(options.sources, pushHistory, { deep: true });

  function undo(): boolean {
    if (past.value.length === 0) return false;

    const current = clone(options.snapshot());
    const nextPast = [...past.value];
    const previous = nextPast.pop() as T;
    past.value = nextPast;
    future.value = [...future.value, current];

    isRestoring = true;
    options.restore(clone(previous));
    lastSnapshot = clone(previous);
    lastPushAt = 0;
    // restore 会触发 watch；等它跑完再解除标记
    queueMicrotask(() => {
      isRestoring = false;
    });
    return true;
  }

  function redo(): boolean {
    if (future.value.length === 0) return false;

    const current = clone(options.snapshot());
    const nextFuture = [...future.value];
    const next = nextFuture.pop() as T;
    future.value = nextFuture;
    past.value = [...past.value, current];

    isRestoring = true;
    options.restore(clone(next));
    lastSnapshot = clone(next);
    lastPushAt = 0;
    queueMicrotask(() => {
      isRestoring = false;
    });
    return true;
  }

  function reset() {
    past.value = [];
    future.value = [];
    lastSnapshot = clone(options.snapshot());
    lastPushAt = 0;
  }

  return { undo, redo, canUndo, canRedo, reset };
}

/**
 * 离开保护：有未保存改动时，关闭/刷新页面前弹浏览器确认。
 *
 * 只在 `shouldBlock()` 返回 true 时拦截，避免“什么都没改也拦人”。
 * 返回清理函数：组件卸载时自动解绑；在 effectScope 里调用也能手动清理，
 * 不依赖 `onBeforeUnmount`（后者只在组件实例内有效）。
 */
export function useLeaveGuard(shouldBlock: () => boolean): () => void {
  const handler = (event: BeforeUnloadEvent) => {
    if (!shouldBlock()) return;
    event.preventDefault();
    // 部分浏览器要求设置 returnValue 才会弹确认
    event.returnValue = '';
  };

  window.addEventListener('beforeunload', handler);
  const dispose = () => window.removeEventListener('beforeunload', handler);

  if (getCurrentInstance()) {
    onBeforeUnmount(dispose);
  }

  return dispose;
}
