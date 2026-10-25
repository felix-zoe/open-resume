import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetPwaState, applyUpdate, dismissUpdate, initPwa, promptInstall, usePwa } from '../../src/composables/usePwa';
import { __setRegisterBehaviour } from './stubs/pwa-register';

/**
 * PWA 逻辑的单测。
 *
 * 这里**不测 Service Worker 本身**（那需要真实浏览器与 HTTPS，
 * 由 `tests/e2e/pwa.spec.ts` 在构建产物上验证）。这里只测
 * 「浏览器事件 → 状态」的映射，因为安装引导显示与否全靠这几个布尔值。
 */

class FakeInstallPromptEvent extends Event {
  outcome: 'accepted' | 'dismissed' = 'accepted';
  prompt = vi.fn().mockResolvedValue(undefined);
  get userChoice() {
    return Promise.resolve({ outcome: this.outcome });
  }
  constructor() {
    // cancelable 必须为 true，否则 preventDefault() 不生效、defaultPrevented 恒为 false
    super('beforeinstallprompt', { cancelable: true });
  }
}

function fireInstallPrompt(outcome: 'accepted' | 'dismissed') {
  const event = new FakeInstallPromptEvent();
  event.outcome = outcome;
  window.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  __resetPwaState();
  __setRegisterBehaviour(null);
});

afterEach(() => {
  __resetPwaState();
  __setRegisterBehaviour(null);
});

describe('PWA 状态', () => {
  it('初始状态：不提示更新、不可安装', () => {
    const { needRefresh, offlineReady, canInstall } = usePwa();
    expect(needRefresh.value).toBe(false);
    expect(offlineReady.value).toBe(false);
    expect(canInstall.value).toBe(false);
  });

  it('对外暴露的是只读引用，组件写入不生效', () => {
    const { needRefresh } = usePwa();
    // @ts-expect-error 只读代理
    needRefresh.value = true;
    // Vue 的 readonly 在开发态只打警告、不抛错，因此断言「值没变」
    expect(needRefresh.value).toBe(false);
  });

  it('没有安装事件时 promptInstall 返回 false，不抛错', async () => {
    await expect(promptInstall()).resolves.toBe(false);
  });

  it('没有 SW 更新函数时 applyUpdate 静默返回', async () => {
    await expect(applyUpdate()).resolves.toBeUndefined();
  });
});

describe('initPwa', () => {
  it('收到 beforeinstallprompt 后标记可安装，并阻止默认迷你信息条', async () => {
    await initPwa();
    const event = fireInstallPrompt('accepted');

    expect(event.defaultPrevented).toBe(true);
    expect(usePwa().canInstall.value).toBe(true);
  });

  it('用户接受安装后清掉安装入口，并标记为已安装', async () => {
    await initPwa();
    fireInstallPrompt('accepted');

    await expect(promptInstall()).resolves.toBe(true);
    expect(usePwa().canInstall.value).toBe(false);
    expect(usePwa().isInstalled.value).toBe(true);
  });

  it('用户拒绝安装：返回 false，入口也收起（不反复打扰）', async () => {
    await initPwa();
    fireInstallPrompt('dismissed');

    await expect(promptInstall()).resolves.toBe(false);
    expect(usePwa().canInstall.value).toBe(false);
  });

  it('SW 报告需要刷新时置 needRefresh，且不自动刷新', async () => {
    __setRegisterBehaviour((options) => options.onNeedRefresh?.());
    await initPwa();

    expect(usePwa().needRefresh.value).toBe(true);
  });

  it('SW 报告离线就绪时置 offlineReady', async () => {
    __setRegisterBehaviour((options) => options.onOfflineReady?.());
    await initPwa();

    expect(usePwa().offlineReady.value).toBe(true);
  });

  it('dismissUpdate 只清掉更新提示，不影响离线就绪', async () => {
    __setRegisterBehaviour((options) => {
      options.onNeedRefresh?.();
      options.onOfflineReady?.();
    });
    await initPwa();

    dismissUpdate();
    expect(usePwa().needRefresh.value).toBe(false);
    expect(usePwa().offlineReady.value).toBe(true);
  });

  it('applyUpdate 调用 SW 的更新函数并清掉提示', async () => {
    __setRegisterBehaviour((options) => options.onNeedRefresh?.());
    await initPwa();

    // 桩的 registerSW 返回一个空异步函数，这里只验证状态收敛
    await applyUpdate();
    expect(usePwa().needRefresh.value).toBe(false);
  });

  it('appinstalled 事件同样收起安装入口', async () => {
    await initPwa();
    fireInstallPrompt('dismissed');

    window.dispatchEvent(new Event('appinstalled'));
    expect(usePwa().canInstall.value).toBe(false);
    expect(usePwa().isInstalled.value).toBe(true);
  });
});
