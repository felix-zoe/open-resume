import { readonly, ref } from 'vue';

/**
 * PWA 安装与更新（4.2.13）。
 *
 * 两件事分开：
 * · **更新**：SW 发现新版本后不自动刷新，弹一条常驻提示让用户决定。
 *   编辑器里可能有没保存的内容，静默刷新等于丢数据。
 * · **安装**：只在浏览器真的抛出 `beforeinstallprompt` 时显示入口。
 *   Chrome 的安装条件（HTTPS、manifest、SW、图标）不满足就不会触发，
 *   我们不去猜「应该可以装了」。
 */

/** Chrome/Edge 的安装事件（未进标准类型） */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const needRefresh = ref(false);
const offlineReady = ref(false);
const canInstall = ref(false);
const isInstalled = ref(false);

let installPrompt: BeforeInstallPromptEvent | null = null;
let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | null = null;

function detectInstalled() {
  if (typeof window === 'undefined') return false;
  // standalone 显示模式 = 已从桌面/主屏启动；旧版 Safari 用 navigator.standalone
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return Boolean(standalone);
}

/**
 * 注册 Service Worker 并挂上安装事件。
 * 只应在生产构建里调用——开发期 SW 会缓存旧的 HMR 产物，调试会变得不可预测。
 */
export async function initPwa(): Promise<void> {
  if (typeof window === 'undefined') return;

  isInstalled.value = detectInstalled();

  window.addEventListener('beforeinstallprompt', (event) => {
    // 阻止 Chrome 自带的迷你信息条，改用我们自己的按钮
    event.preventDefault();
    installPrompt = event as BeforeInstallPromptEvent;
    canInstall.value = true;
  });

  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    canInstall.value = false;
    isInstalled.value = true;
  });

  try {
    const mod = await import('virtual:pwa-register');
    updateServiceWorker = mod.registerSW({
      immediate: true,
      onNeedRefresh() {
        needRefresh.value = true;
      },
      onOfflineReady() {
        offlineReady.value = true;
      }
    });
  } catch {
    // 浏览器不支持 SW（或构建产物里没有 SW）时静默降级：
    // 应用本身是纯前端 SPA，没有 SW 也能正常使用，只是不能离线。
  }
}

/** 用户点「稍后」：本次会话不再提示，下次打开若仍有新版本会再弹 */
export function dismissUpdate(): void {
  needRefresh.value = false;
}

/** 用户点「刷新更新」：激活新 SW 并重载页面 */
export async function applyUpdate(): Promise<void> {
  if (!updateServiceWorker) return;
  await updateServiceWorker(true);
  needRefresh.value = false;
}

/** 触发浏览器安装弹窗；用户拒绝或没有可用事件时返回 false */
export async function promptInstall(): Promise<boolean> {
  if (!installPrompt) return false;
  await installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  installPrompt = null;
  canInstall.value = false;
  // Chrome 之后还会抛 `appinstalled`，但两者之间可能有几百毫秒；
  // 先在这里置位，避免安装入口在动画里闪一下又消失。
  if (outcome === 'accepted') isInstalled.value = true;
  return outcome === 'accepted';
}

export function usePwa() {
  return {
    needRefresh: readonly(needRefresh),
    offlineReady: readonly(offlineReady),
    canInstall: readonly(canInstall),
    isInstalled: readonly(isInstalled),
    applyUpdate,
    dismissUpdate,
    promptInstall
  };
}

/** 测试用：重置模块级状态 */
export function __resetPwaState(): void {
  needRefresh.value = false;
  offlineReady.value = false;
  canInstall.value = false;
  isInstalled.value = false;
  installPrompt = null;
  updateServiceWorker = null;
}
