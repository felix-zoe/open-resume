import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import { useLeaveGuard, useUndoRedo } from '../../src/composables/useUndoRedo';

interface State {
  text: string;
  size: number;
}

/** 在独立的 effectScope 里创建，便于用完即弃 */
function createHistory(initial: State, options: { mergeWindow?: number; limit?: number } = {}) {
  const scope = effectScope();
  const state = ref<State>({ ...initial });

  const api = scope.run(() =>
    useUndoRedo<State>({
      snapshot: () => state.value,
      restore: (snapshot) => {
        state.value = snapshot;
      },
      sources: [state],
      mergeWindow: options.mergeWindow ?? 0,
      limit: options.limit ?? 50,
    })
  )!;

  return { state, api, stop: () => scope.stop() };
}

describe('useUndoRedo', () => {
  let stop: (() => void) | null = null;

  afterEach(() => {
    stop?.();
    stop = null;
    vi.useRealTimers();
  });

  it('没有历史时 undo/redo 返回 false', () => {
    const ctx = createHistory({ text: 'a', size: 1 });
    stop = ctx.stop;

    expect(ctx.api.canUndo.value).toBe(false);
    expect(ctx.api.canRedo.value).toBe(false);
    expect(ctx.api.undo()).toBe(false);
    expect(ctx.api.redo()).toBe(false);
  });

  it('编辑后可撤销回上一个状态', async () => {
    const ctx = createHistory({ text: 'a', size: 1 });
    stop = ctx.stop;

    ctx.state.value = { text: 'ab', size: 2 };
    await nextTick();

    expect(ctx.api.canUndo.value).toBe(true);
    expect(ctx.api.undo()).toBe(true);
    await nextTick();

    expect(ctx.state.value).toEqual({ text: 'a', size: 1 });
  });

  it('撤销后可重做', async () => {
    const ctx = createHistory({ text: 'a', size: 1 });
    stop = ctx.stop;

    ctx.state.value = { text: 'ab', size: 2 };
    await nextTick();
    ctx.api.undo();
    await nextTick();

    expect(ctx.api.canRedo.value).toBe(true);
    expect(ctx.api.redo()).toBe(true);
    await nextTick();

    expect(ctx.state.value).toEqual({ text: 'ab', size: 2 });
  });

  it('连续多次编辑可逐步回退', async () => {
    const ctx = createHistory({ text: '', size: 0 });
    stop = ctx.stop;

    for (const value of ['a', 'ab', 'abc']) {
      ctx.state.value = { text: value, size: value.length };
      await nextTick();
    }

    ctx.api.undo();
    await nextTick();
    expect(ctx.state.value.text).toBe('ab');

    ctx.api.undo();
    await nextTick();
    expect(ctx.state.value.text).toBe('a');
  });

  it('合并窗口内的连续输入只记一个快照', async () => {
    // 用真实的 Date.now() 推进判断；只把时间“冻结”在同一毫秒，
    // 避免假定时器让 Date.now() 不前进、窗口判断失效。
    const now = Date.now();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now);

    const ctx = createHistory({ text: '', size: 0 }, { mergeWindow: 500 });
    stop = ctx.stop;

    // 模拟逐字输入，全部落在同一个 500ms 窗口内
    ctx.state.value = { text: 'a', size: 1 };
    await nextTick();
    ctx.state.value = { text: 'ab', size: 2 };
    await nextTick();
    ctx.state.value = { text: 'abc', size: 3 };
    await nextTick();

    spy.mockRestore();

    // 一次撤销应回到输入前，而不是只退一个字
    ctx.api.undo();
    await nextTick();
    expect(ctx.state.value.text).toBe('');
  });

  it('超出栈上限时丢弃最旧的快照', async () => {
    const ctx = createHistory({ text: '0', size: 0 }, { limit: 3 });
    stop = ctx.stop;

    for (let i = 1; i <= 6; i += 1) {
      ctx.state.value = { text: String(i), size: i };
      await nextTick();
    }

    // 最多只能回退 3 步
    let steps = 0;
    while (ctx.api.undo()) {
      steps += 1;
      await nextTick();
      if (steps > 10) break;
    }
    expect(steps).toBeLessThanOrEqual(3);
  });

  it('新的编辑会清空重做分支', async () => {
    const ctx = createHistory({ text: 'a', size: 1 });
    stop = ctx.stop;

    ctx.state.value = { text: 'ab', size: 2 };
    await nextTick();
    ctx.api.undo();
    await nextTick();
    expect(ctx.api.canRedo.value).toBe(true);

    ctx.state.value = { text: 'ax', size: 2 };
    await nextTick();
    expect(ctx.api.canRedo.value).toBe(false);
  });

  it('reset 清空全部历史', async () => {
    const ctx = createHistory({ text: 'a', size: 1 });
    stop = ctx.stop;

    ctx.state.value = { text: 'ab', size: 2 };
    await nextTick();
    ctx.api.reset();

    expect(ctx.api.canUndo.value).toBe(false);
    expect(ctx.api.canRedo.value).toBe(false);
  });

  it('恢复动作本身不会被记成一次新编辑', async () => {
    const ctx = createHistory({ text: 'a', size: 1 });
    stop = ctx.stop;

    ctx.state.value = { text: 'ab', size: 2 };
    await nextTick();
    ctx.api.undo();
    await nextTick();
    await nextTick();

    // 撤销后栈应为空，而不是又压进一个“撤销后的状态”
    expect(ctx.api.canUndo.value).toBe(false);
  });
});

describe('useLeaveGuard', () => {
  const disposers: Array<() => void> = [];

  beforeEach(() => {
    disposers.length = 0;
  });

  // 每个用例结束都要解绑，否则前一个 guard 会继续响应后续事件
  afterEach(() => {
    disposers.forEach((dispose) => dispose());
    disposers.length = 0;
  });

  function mountGuard(shouldBlock: () => boolean) {
    const scope = effectScope();
    const dispose = scope.run(() => useLeaveGuard(shouldBlock))!;
    disposers.push(() => {
      dispose();
      scope.stop();
    });
    return scope;
  }

  it('有未保存改动时阻止离开', () => {
    mountGuard(() => true);

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    const prevented = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(prevented).toHaveBeenCalled();
  });

  it('没有改动时不干预', () => {
    mountGuard(() => false);

    const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
    const prevented = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(prevented).not.toHaveBeenCalled();
  });
});
