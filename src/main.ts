import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';
import { useResumeStore } from './stores/resume';
import { setUnauthorizedHandler } from './utils/http';
import { initTelemetry } from './utils/telemetry';
import './assets/main.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

/**
 * 全局 401 处理：清除本地登录态并跳转登录页。
 * 在这里注册而不是在 http.ts 里 import store/router，避免循环依赖。
 */
setUnauthorizedHandler((redirect) => {
  const authStore = useAuthStore(pinia);
  authStore.logout();
  router.replace({ name: 'Login', query: { redirect } });
});

/**
 * 可观测性（T5.6）：全局错误、Web Vitals、业务埋点。
 *
 * 只在生产构建里启用：开发期 HMR 会频繁抛「组件已卸载」之类的假错误，
 * 上报上去只会污染数据；`npm run dev` 里也看不到任何网络请求，调试更清爽。
 * 用户开了 DNT/GPC 时 `initTelemetry` 内部直接不装监听。
 */
if (import.meta.env.PROD) {
  initTelemetry();
}

/**
 * 启动时把旧版 localStorage 草稿迁到 IndexedDB。
 * 幂等且不阻塞渲染：失败只是少一次迁移，不影响任何编辑功能。
 */
void (async () => {
  try {
    const resumeStore = useResumeStore(pinia);
    await resumeStore.migrateLegacyDrafts();
    resumeStore.pruneLegacyBackups();
  } catch (err) {
    console.warn('本地草稿迁移失败（不影响使用）:', err);
  }
})();

app.mount('#app');
