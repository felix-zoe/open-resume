import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { trackEvent } from '../utils/telemetry';

// 首页也走懒加载：它带着示例区与模板缩略图，同步导入会让首屏 chunk
// 变成「登录页/编辑器也要下载首页代码」。路由级拆分后每个入口只付自己的成本。
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomeView.vue')
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue')
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/LoginView.vue')
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/jobs',
    name: 'Jobs',
    component: () => import('../views/JobsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/editor/:id',
    name: 'Editor',
    component: () => import('../views/EditorView.vue')
  },
  {
    path: '/share/:id',
    name: 'Share',
    component: () => import('../views/ShareView.vue')
  },
  {
    // token 化分享链接：/s/:token，与 /share/:id 共用同一个只读页面
    path: '/s/:token',
    name: 'ShareToken',
    component: () => import('../views/ShareView.vue')
  },
  {
    path: '/privacy',
    name: 'Privacy',
    component: () => import('../views/PrivacyView.vue')
  },
  {
    path: '/terms',
    name: 'Terms',
    component: () => import('../views/TermsView.vue')
  },
  {
    path: '/examples',
    name: 'Examples',
    component: () => import('../views/ExamplesView.vue')
  },
  {
    // 示例详情：与列表共用同一个组件，靠 route.params.slug 区分
    path: '/examples/:slug',
    name: 'ExampleDetail',
    component: () => import('../views/ExamplesView.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundView.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 全局路由导航守卫：未登录拦截受保护路由
router.beforeEach((to, _, next) => {
  const token = localStorage.getItem('open_resume_token');
  if (to.meta.requiresAuth && !token) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
  } else {
    next();
  }
});

/**
 * 页面浏览埋点（T5.6）。
 *
 * 用路由名而不是路径：`/editor/res_abc` 与 `/editor/res_def` 是同一个页面，
 * 按路径统计会把一个页面的流量拆成上千行。路由名是开发者定义的白名单，
 * 也天然挡住了「用户输入出现在 URL 里」的泄露风险。
 */
router.afterEach((to) => {
  const name = typeof to.name === 'string' ? to.name : 'unknown';
  trackEvent(`page.${name}`);
});

export default router;
