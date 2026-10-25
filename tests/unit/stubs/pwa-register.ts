/**
 * `virtual:pwa-register` 的测试桩。
 *
 * 真实模块由 vite-plugin-pwa 在构建期生成。单元测试里用这个桩让
 * `usePwa.ts` 拿到一个可控的 `registerSW`：默认立刻返回，
 * 用例可以通过 `__setRegisterBehaviour()` 让它触发「需要刷新 / 可离线」回调。
 */

export interface RegisterSWOptions {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (url: string, registration?: ServiceWorkerRegistration) => void;
  onRegisterError?: (error: unknown) => void;
}

type Behaviour = (options: RegisterSWOptions) => void;

let behaviour: Behaviour | null = null;

export function __setRegisterBehaviour(next: Behaviour | null) {
  behaviour = next;
}

export function registerSW(options: RegisterSWOptions = {}) {
  behaviour?.(options);
  return async () => {};
}

export default registerSW;
