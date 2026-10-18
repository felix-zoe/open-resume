import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { useAuthStore } from './stores/auth';
import { setUnauthorizedHandler } from './utils/http';
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

app.mount('#app');
